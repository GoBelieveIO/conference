//
//  ConferenceViewController.m
//  Face
//
//  Created by houxh on 2016/12/7.
//  Copyright © 2016年 beetle. All rights reserved.
//

#import "GroupVOIPViewController.h"
#import <React/RCTBundleURLProvider.h>
#import <React/RCTRootView.h>

#import <React/RCTBridgeModule.h>
#import <React/RCTBridge.h>
#import <React/RCTEventDispatcher.h>
#import <AVFoundation/AVFoundation.h>
#import <Masonry/Masonry.h>

#import "AppDelegate.h"
#import "Participant.h"
#import "WebRTCVideoView.h"

#define kBtnWidth  72
#define kBtnHeight 72

#define kVideoViewWidth 160
#define kVideoViewHeight 160

@interface RTCIceCandidate (GroupCall)

+ (RTCIceCandidate *)candidateFromJSONDictionary2:(NSDictionary *)dictionary;
- (NSDictionary *)JSONDictionary2;
@end

@implementation RTCIceCandidate(GroupCall)
+ (RTCIceCandidate *)candidateFromJSONDictionary2:(NSDictionary *)dictionary {
    NSString *mid = dictionary[@"sdpMid"];
    NSString *sdp = dictionary[@"candidate"];
    NSNumber *num = dictionary[@"sdpMLineIndex"];
    int mLineIndex = [num intValue];
    return [[RTCIceCandidate alloc] initWithSdp:sdp
                                  sdpMLineIndex:mLineIndex
                                         sdpMid:mid];
}
- (NSDictionary *)JSONDictionary2 {
    NSDictionary *json = @{
                           @"sdpMLineIndex" : @(self.sdpMLineIndex),
                           @"sdpMid" : self.sdpMid,
                           @"candidate" : self.sdp
                           };
    return json;
}
@end


static int64_t g_controllerCount = 0;




@interface GroupVOIPViewController ()<RCTBridgeModule>
@property(nonatomic, strong) RTCPeerConnectionFactory *factory;
@property(nonatomic) NSMutableArray *participants;

@property(nonatomic, strong) RCTBridge *reactBridge;

@property(nonatomic, weak) UIButton *cameraButton;
@property(nonatomic, weak) UIButton *muteButton;
@property(nonatomic, weak) UIButton *hangUpButton;
@property(nonatomic, weak) UIScrollView *scrollView;
@end

@implementation GroupVOIPViewController
RCT_EXPORT_MODULE();


RCT_EXPORT_METHOD(onClose:(NSString*)channelID) {
    NSLog(@"on room closed");
    for (Participant *p in self.participants) {
        [p dispose];
        [p.videoView removeFromSuperview];
        p.videoView = nil;
    }
    [self.participants removeAllObjects];
}


RCT_EXPORT_METHOD(onMessage:(NSDictionary*)msg channelID:(NSString*)channelID) {
    NSLog(@"conference message:%@ channel id:%@", msg, channelID);
    if (![self.channelID isEqualToString:channelID]) {
        NSLog(@"channel id invalid:%@ %@", self.channelID, channelID);
        return;
    }
    
    NSString *msgId = [msg objectForKey:@"id"];
    
    if ([msgId isEqualToString:@"existingParticipants"]) {
        [self onExistingParticipants:msg];
    } else if ([msgId isEqualToString:@"newParticipantArrived"]) {
        [self onNewParticipantArrived:msg];
    } else if ([msgId isEqualToString:@"participantLeft"]) {
        [self onParticipantLeft:msg];
    } else if ([msgId isEqualToString:@"receiveVideoAnswer"]) {
        [self onReceiveVideoAnswer:msg];
    } else if ([msgId isEqualToString:@"iceCandidate"]) {
        [self onIceCandidate:msg];
    } else {
        NSLog(@"unrecognized message:%@", msg);
    }
}

- (dispatch_queue_t)methodQueue {
    return dispatch_get_main_queue();
}


+(int64_t)controllerCount {
    return g_controllerCount;
}


//http://stackoverflow.com/questions/24595579/how-to-redirect-audio-to-speakers-in-the-apprtc-ios-example
- (void)didSessionRouteChange:(NSNotification *)notification
{
    NSDictionary *interuptionDict = notification.userInfo;
    NSInteger routeChangeReason = [[interuptionDict valueForKey:AVAudioSessionRouteChangeReasonKey] integerValue];
    NSLog(@"route change:%zd", routeChangeReason);
    if (![self isHeadsetPluggedIn] && ![self isLoudSpeaker]) {
        NSError* error;
        [[AVAudioSession sharedInstance] overrideOutputAudioPort:AVAudioSessionPortOverrideSpeaker error:&error];
    }
}

- (BOOL)isHeadsetPluggedIn {
    AVAudioSessionRouteDescription *route = [[AVAudioSession sharedInstance] currentRoute];
    
    BOOL headphonesLocated = NO;
    for( AVAudioSessionPortDescription *portDescription in route.outputs )
    {
        headphonesLocated |= ( [portDescription.portType isEqualToString:AVAudioSessionPortHeadphones] );
    }
    return headphonesLocated;
}


-(BOOL)isLoudSpeaker {
    AVAudioSession* session = [AVAudioSession sharedInstance];
    AVAudioSessionCategoryOptions options = session.categoryOptions;
    BOOL enabled = options & AVAudioSessionCategoryOptionDefaultToSpeaker;
    return enabled;
}


-(void)dealloc {
    g_controllerCount--;
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)viewDidLoad {
    [super viewDidLoad];
    g_controllerCount++;
    
    self.factory = [[RTCPeerConnectionFactory alloc] init];
    self.participants = [NSMutableArray array];
    
    
    __weak GroupVOIPViewController *wself = self;
    RCTBridgeModuleProviderBlock provider = ^NSArray<id<RCTBridgeModule>> *{
        return @[wself];
    };
    
    NSLog(@"conference id:%@", self.channelID);
    
    NSURL *jsCodeLocation = [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index.ios"
                                                                           fallbackResource:nil];
    
    
    RCTBridge *bridge = [[RCTBridge alloc] initWithBundleURL:jsCodeLocation
                                              moduleProvider:provider
                                               launchOptions:nil];
    
    self.reactBridge = bridge;
    

    
    [[UIApplication sharedApplication] setIdleTimerDisabled:YES];
    
    if (![self isHeadsetPluggedIn] && ![self isLoudSpeaker]) {
        NSError* error;
        [[AVAudioSession sharedInstance] overrideOutputAudioPort:AVAudioSessionPortOverrideSpeaker error:&error];
    }
    
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(didSessionRouteChange:) name:AVAudioSessionRouteChangeNotification object:nil];
    
    
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(bridgeDidReload)
                                                 name:RCTJavaScriptWillStartLoadingNotification
                                               object:bridge];
    
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(javaScriptDidLoad:)
                                                 name:RCTJavaScriptDidLoadNotification
                                               object:bridge];
    
    UIScrollView *scrollView = [[UIScrollView alloc] init];
    self.scrollView = scrollView;
    [self.view addSubview:self.scrollView];
    
    [self.scrollView mas_makeConstraints:^(MASConstraintMaker *make) {
        make.height.equalTo(self.view.mas_width);
        make.width.equalTo(self.view.mas_width);
        make.top.equalTo(self.view.mas_top).with.offset(60);
    }];
    
    UIButton *hangUpButton = [[UIButton alloc] init];
    self.hangUpButton = hangUpButton;
    [self.hangUpButton setBackgroundImage:[UIImage imageNamed:@"Call_hangup"] forState:UIControlStateNormal];
    [self.hangUpButton setBackgroundImage:[UIImage imageNamed:@"Call_hangup_p"] forState:UIControlStateHighlighted];
    [self.hangUpButton addTarget:self
                          action:@selector(hangUp:)
                forControlEvents:UIControlEventTouchUpInside];
    [self.view addSubview:self.hangUpButton];
    
    [self.hangUpButton mas_makeConstraints:^(MASConstraintMaker *make) {
        make.centerX.equalTo(self.view.mas_centerX);
        make.size.mas_equalTo(CGSizeMake(kBtnWidth, kBtnHeight));
        make.bottom.equalTo(self.view.mas_bottom).with.offset(-80);
    }];
    
    UIButton *muteButton = [[UIButton alloc] init];
    self.muteButton = muteButton;
    [self.muteButton setImage:[UIImage imageNamed:@"unmute"] forState:UIControlStateNormal];
    [self.muteButton addTarget:self
                        action:@selector(mute:)
              forControlEvents:UIControlEventTouchUpInside];
    [self.view addSubview:self.muteButton];
    
    [self.muteButton mas_makeConstraints:^(MASConstraintMaker *make) {
        make.centerX.equalTo(self.view.mas_right).with.multipliedBy(0.25);
        make.size.mas_equalTo(CGSizeMake(42, 42));
        make.bottom.equalTo(self.view.mas_bottom).with.offset(-95);
    }];
    
    UIButton *cameraButton = [[UIButton alloc] init];
    self.cameraButton = cameraButton;
    [self.cameraButton setImage:[UIImage imageNamed:@"camera"] forState:UIControlStateNormal];
    [self.cameraButton addTarget:self
                          action:@selector(toggleCamera:)
                forControlEvents:UIControlEventTouchUpInside];
    [self.view addSubview:self.cameraButton];
    
    [self.cameraButton mas_makeConstraints:^(MASConstraintMaker *make) {
        make.centerX.equalTo(self.view.mas_right).with.multipliedBy(0.75);
        make.size.mas_equalTo(CGSizeMake(42, 42));
        make.bottom.equalTo(self.view.mas_bottom).with.offset(-95);
    }];
    
    
    [self requestPermission];
    
    
    [self enterRoom];
    
}

- (void)bridgeDidReload {
    NSLog(@"bridge did reload");
}

- (void)javaScriptDidLoad:(NSNotification *)notification {
    NSLog(@"javascript did load");
}



-(void)hangUp:(id)sender {
    NSLog(@"hangup...");
    
    for (Participant *p in self.participants) {
        [p dispose];
        [p.videoView removeFromSuperview];
        p.videoView = nil;
    }
    
    [[UIApplication sharedApplication] setIdleTimerDisabled:NO];

    [self.reactBridge invalidate];

    [self dismissViewControllerAnimated:YES completion:nil];

}

- (void)requestPermission {
    AVAuthorizationStatus authStatus = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeVideo];
    if(authStatus == AVAuthorizationStatusAuthorized) {
        
    } else if(authStatus == AVAuthorizationStatusDenied){
        // denied
    } else if(authStatus == AVAuthorizationStatusRestricted){
        // restricted, normally won't happen
    } else if(authStatus == AVAuthorizationStatusNotDetermined){
        // not determined?!
        [AVCaptureDevice requestAccessForMediaType:AVMediaTypeVideo completionHandler:^(BOOL granted) {
            if(granted){
            } else {
                NSLog(@"Not granted access to %@", AVMediaTypeVideo);
            }
        }];
    }
    
    AVAuthorizationStatus audioAuthStatus = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio];
    if(audioAuthStatus == AVAuthorizationStatusAuthorized) {
        
    } else if(audioAuthStatus == AVAuthorizationStatusDenied){
        // denied
    } else if(audioAuthStatus == AVAuthorizationStatusRestricted){
        // restricted, normally won't happen
    } else if(audioAuthStatus == AVAuthorizationStatusNotDetermined){
        [[AVAudioSession sharedInstance] requestRecordPermission:^(BOOL granted) {
            if (granted) {
            } else {
                NSLog(@"Not granted access to %@", AVMediaTypeAudio);
            }
        }];
    }
}


- (void)enterRoom {
    NSDictionary *body = @{@"channelID":self.channelID,
                           @"uid":@(self.currentUID),
                           @"token":@"",
                           };
    RCTBridge *bridge = self.reactBridge;
    [bridge.eventDispatcher sendAppEventWithName:@"enter_room" body:body];
}

- (void)leaveRoom {
    NSDictionary *body = @{@"channelID":self.channelID};
    RCTBridge *bridge = self.reactBridge;
    [bridge.eventDispatcher sendAppEventWithName:@"leave_room" body:body];
}

-(void)sendRoomMessage:(NSDictionary*)msg {
    NSDictionary *event = @{@"channelID":self.channelID, @"message":msg};
    
    RCTBridge *bridge = self.reactBridge;
    [bridge.eventDispatcher sendAppEventWithName:@"send_room_message"
                                            body:event];
}

-(Participant*)createTestParticipant {
    Participant *p = [[Participant alloc] init];
    p.local = NO;

    
    p.videoView = [[WebRTCVideoView alloc] initWithFrame:CGRectZero];
    p.videoView.objectFit = WebRTCVideoViewObjectFitCover;
    p.videoView.clipsToBounds = YES;
    p.videoView.backgroundColor = [UIColor redColor];
    
    CGFloat w = self.view.frame.size.width/2;
    CGFloat h = w;
    CGFloat y = h*(self.participants.count/2);
    CGFloat x = w*(self.participants.count%2);
    p.videoView.frame = CGRectMake(x, y, w, h);
    [self.scrollView addSubview:p.videoView];
    [self.participants addObject:p];
    
    self.scrollView.contentSize = CGSizeMake(w*2, h*(self.participants.count%2+self.participants.count/2));
    
    return p;
}

-(Participant*)createLocalParticipant {
    Participant *p = [[Participant alloc] init];
    p.uid = self.currentUID;
    p.local = YES;
    p.videoView = [[WebRTCVideoView alloc] initWithFrame:CGRectZero];
    p.videoView.objectFit = WebRTCVideoViewObjectFitCover;
    p.videoView.clipsToBounds = YES;
    
    __weak GroupVOIPViewController *wself = self;
    p.offerCB = ^(Participant *p, RTCSessionDescription *sdp) {
        NSDictionary *msg = @{@"id":@"receiveVideoFrom", @"sender":@(p.uid), @"sdpOffer":sdp.sdp};
        dispatch_async(dispatch_get_main_queue(), ^{
            [wself sendRoomMessage:msg];
        });
    };
    
    p.iceCB = ^(Participant *p, RTCIceCandidate *ice) {
        NSDictionary *dict = [ice JSONDictionary2];
        NSDictionary *msg = @{@"id":@"onIceCandidate", @"name":@(p.uid), @"candidate":dict};
        dispatch_async(dispatch_get_main_queue(), ^{
            [wself sendRoomMessage:msg];
        });
    };
    
    [p createPeerConnection:self.factory];

    UITapGestureRecognizer* singleTap = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(switchCamera:)];
    [p.videoView addGestureRecognizer:singleTap];

    CGFloat w = self.view.frame.size.width/2;
    CGFloat h = w;
    CGFloat y = h*(self.participants.count/2);
    CGFloat x = w*(self.participants.count%2);
    p.videoView.frame = CGRectMake(x, y, w, h);
    [self.scrollView addSubview:p.videoView];
    
    [self.participants addObject:p];
    self.scrollView.contentSize = CGSizeMake(w*2, h*(self.participants.count%2+self.participants.count/2));
    return p;
}


-(Participant*)createRemoteParticipant:(int64_t)peer {
    Participant *p = [[Participant alloc] init];
    p.local = NO;
    p.uid = peer;

    p.videoView = [[WebRTCVideoView alloc] initWithFrame:CGRectZero];
    p.videoView.objectFit = WebRTCVideoViewObjectFitCover;
    p.videoView.clipsToBounds = YES;

    
    __weak GroupVOIPViewController *wself = self;
    p.offerCB = ^(Participant *p, RTCSessionDescription *sdp) {
        NSDictionary *msg = @{@"id":@"receiveVideoFrom", @"sender":@(p.uid), @"sdpOffer":sdp.sdp};
        dispatch_async(dispatch_get_main_queue(), ^{
            [wself sendRoomMessage:msg];
        });
    };
    
    p.iceCB = ^(Participant *p, RTCIceCandidate *ice) {
        NSDictionary *dict = [ice JSONDictionary2];
        NSDictionary *msg = @{@"id":@"onIceCandidate", @"name":@(p.uid), @"candidate":dict};
        dispatch_async(dispatch_get_main_queue(), ^{
            [wself sendRoomMessage:msg];
        });
    };
    
    [p createRemotePeerConnection:self.factory];
    
    CGFloat w = self.view.frame.size.width/2;
    CGFloat h = w;
    CGFloat y = h*(self.participants.count/2);
    CGFloat x = w*(self.participants.count%2);
    p.videoView.frame = CGRectMake(x, y, w, h);
    [self.scrollView addSubview:p.videoView];
    
    [self.participants addObject:p];

    self.scrollView.contentSize = CGSizeMake(w*2, h*(self.participants.count%2+self.participants.count/2));
    
    return p;
}

-(void)onExistingParticipants:(NSDictionary*)msg {
    [self createLocalParticipant];
    NSArray *data = [msg objectForKey:@"data"];
    for (NSString *pid in data) {
        [self createRemoteParticipant:[pid longLongValue]];
    }
}

-(void)onReceiveVideoAnswer:(NSDictionary*)msg {
    int64_t uid = [[msg objectForKey:@"name"] longLongValue];
    
    NSUInteger index = [self.participants indexOfObjectPassingTest:^BOOL(id  _Nonnull obj, NSUInteger idx, BOOL * _Nonnull stop) {
        Participant *p = (Participant*)obj;
        if (p.uid == uid) {
            *stop = YES;
        }
        return p.uid == uid;
    }];
    
    if (index == NSNotFound) {
        return;
    }
    
    Participant *p = [self.participants objectAtIndex:index];
    NSString *sdp = [msg objectForKey:@"sdpAnswer"];
    RTCSessionDescription *description = [[RTCSessionDescription alloc] initWithType:RTCSdpTypeAnswer sdp:sdp];
    [p.peerConnection setRemoteDescription:description
                         completionHandler:^(NSError *error) {
                             if (error) {
                                 NSLog(@"set remote description error:%@", error);
                                 return;
                             }
                             NSLog(@"set remote description success");
                         }];
}

-(void)onNewParticipantArrived:(NSDictionary*)msg {
    int64_t pid = [[msg objectForKey:@"name"] longLongValue];
    
    NSUInteger index = [self.participants indexOfObjectPassingTest:^BOOL(id  _Nonnull obj, NSUInteger idx, BOOL * _Nonnull stop) {
        Participant *p = (Participant*)obj;
        if (p.uid == pid) {
            *stop = YES;
        }
        return p.uid == pid;
    }];
    
    if (index != NSNotFound) {
        return;
    }
    
    [self createRemoteParticipant:pid];
}

-(void)onParticipantLeft:(NSDictionary*)msg {
    int64_t pid = [[msg objectForKey:@"name"] longLongValue];
    
    NSUInteger index = [self.participants indexOfObjectPassingTest:^BOOL(id  _Nonnull obj, NSUInteger idx, BOOL * _Nonnull stop) {
        Participant *p = (Participant*)obj;
        if (p.uid == pid) {
            *stop = YES;
        }
        return p.uid == pid;
    }];
    
    if (index == NSNotFound) {
        return;
    }
    
    Participant *p = [self.participants objectAtIndex:index];
    [p dispose];
    [self.participants removeObjectAtIndex:index];
    [p.videoView removeFromSuperview];
    p.videoView = nil;

    for (NSInteger i = 0; i < self.participants.count; i++) {
        CGFloat w = self.view.frame.size.width/2;
        CGFloat h = w;
        CGFloat y = h*(i/2);
        CGFloat x = w*(i%2);
        p.videoView.frame = CGRectMake(x, y, w, h);
    }
    
    CGFloat w = self.view.frame.size.width/2;
    CGFloat h = w;
    self.scrollView.contentSize = CGSizeMake(w, h*(self.participants.count%2+self.participants.count/2));
}


-(void)onIceCandidate:(NSDictionary*)msg {
    int64_t uid = [[msg objectForKey:@"name"] longLongValue];
    
    NSUInteger index = [self.participants indexOfObjectPassingTest:^BOOL(id  _Nonnull obj, NSUInteger idx, BOOL * _Nonnull stop) {
        Participant *p = (Participant*)obj;
        if (p.uid == uid) {
            *stop = YES;
        }
        return p.uid == uid;
    }];
    
    if (index == NSNotFound) {
        return;
    }
    Participant *p = [self.participants objectAtIndex:index];
    RTCIceCandidate *ice = [RTCIceCandidate candidateFromJSONDictionary2:[msg objectForKey:@"candidate"]];
    NSLog(@"pc signalingState:%zd %d", p.peerConnection.signalingState, p.peerConnection.remoteDescription != nil);
    [p.peerConnection addIceCandidate:ice];
}

-(void)switchCamera:(id)sender {
    if (self.participants.count == 0) {
        return;
    }
    Participant *p = [self.participants objectAtIndex:0];
    if (p.uid != self.currentUID) {
        return;
    }
    if (!p.videoTrack.isEnabled) {
        return;
    }
    
    NSLog(@"switch camera...");
    RTCVideoSource* source = p.videoTrack.source;
    if ([source isKindOfClass:[RTCAVFoundationVideoSource class]]) {
        RTCAVFoundationVideoSource* avSource = (RTCAVFoundationVideoSource*)source;
        avSource.useBackCamera = !avSource.useBackCamera;
    }
}

-(void)mute:(id)sender {
    if (self.participants.count == 0) {
        return;
    }
    Participant *p = [self.participants objectAtIndex:0];
    if (p.uid != self.currentUID) {
        return;
    }
    
    NSLog(@"toogle audio...");
    p.audioTrack.isEnabled = !p.audioTrack.isEnabled;
    if (p.audioTrack.isEnabled) {
        [self.muteButton setImage:[UIImage imageNamed:@"unmute"] forState:UIControlStateNormal];
    } else {
        [self.muteButton setImage:[UIImage imageNamed:@"mute"] forState:UIControlStateNormal];
    }
}

-(void)toggleCamera:(id)sender {
    if (self.participants.count == 0) {
        return;
    }
    Participant *p = [self.participants objectAtIndex:0];
    if (p.uid != self.currentUID) {
        return;
    }

    NSLog(@"toogle camera camera...");
    p.videoTrack.isEnabled = !p.videoTrack.isEnabled;
}


-(int)setLoudspeakerStatus:(BOOL)enable {
    AVAudioSession* session = [AVAudioSession sharedInstance];
    NSString* category = session.category;
    AVAudioSessionCategoryOptions options = session.categoryOptions;
    // Respect old category options if category is
    // AVAudioSessionCategoryPlayAndRecord. Otherwise reset it since old options
    // might not be valid for this category.
    if ([category isEqualToString:AVAudioSessionCategoryPlayAndRecord]) {
        if (enable) {
            options |= AVAudioSessionCategoryOptionDefaultToSpeaker;
        } else {
            options &= ~AVAudioSessionCategoryOptionDefaultToSpeaker;
        }
    } else {
        options = AVAudioSessionCategoryOptionDefaultToSpeaker;
    }
    
    NSError* error = nil;
    [session setCategory:AVAudioSessionCategoryPlayAndRecord
             withOptions:options
                   error:&error];
    if (error != nil) {
        NSLog(@"set loudspeaker err:%@", error);
        return -1;
    }
    
    return 0;
}



@end
