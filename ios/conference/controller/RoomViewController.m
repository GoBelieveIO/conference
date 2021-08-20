//
//  RoomViewController.m
//  conference
//
//  Created by houxh on 2021/8/20.
//  Copyright © 2021 beetle. All rights reserved.
//

#import "RoomViewController.h"
#import <React/RCTBridgeModule.h>
#import <React/RCTBridge.h>
#import <React/RCTBundleURLProvider.h>
#import <Masonry/Masonry.h>
#import "RoomModule.h"
#import "WebRTCVideoView.h"
#import <react-native-webrtc/WebRTCModule.h>

#define RGBCOLOR(r,g,b) [UIColor colorWithRed:(r)/255.0f green:(g)/255.0f blue:(b)/255.0f alpha:1]
#define kBtnWidth  72
#define kBtnHeight 72

#define kVideoViewWidth 160
#define kVideoViewHeight 160

@interface Peer : NSObject
@property(nonatomic) NSString *id;
@property(nonatomic) NSString *displayName;
@property(nonatomic) NSMutableDictionary *consumers;
@property(nonatomic) WebRTCVideoView *videoView;
@end

@implementation Peer

@end


@interface RoomViewController ()<RoomModuleDelegate>
@property(nonatomic, strong) RCTBridge *bridge;

@property(nonatomic) NSMutableDictionary *producers;
@property(nonatomic) NSMutableArray *peers;
@property(nonatomic) NSMutableDictionary *peersDict;

@property(nonatomic, weak) WebRTCVideoView *localVideoView;
@property(nonatomic, weak) UIView *blackMask;//置于localviewview之上，黑色背景

@property(nonatomic, assign) BOOL cameraOn;
@property(nonatomic, assign) BOOL microphoneOn;

@property(nonatomic, weak) UILabel *durationLabel;
@property(nonatomic, weak) UIButton *cameraButton;
@property(nonatomic, weak) UIButton *muteButton;
@property(nonatomic, weak) UIButton *hangUpButton;
@property(nonatomic, weak) UIScrollView *scrollView;
@property(nonatomic, readonly) RoomModule *roomModule;
@end

@implementation RoomViewController

-(RoomModule*)roomModule {
    RoomModule *roomModule = [self.bridge moduleForClass:[RoomModule class]];
    return roomModule;
}

- (void)viewDidLoad {
    [super viewDidLoad];
 
    self.view.backgroundColor = RGBCOLOR(36, 37, 42);

    self.peers = [NSMutableArray array];
    self.peersDict = [NSMutableDictionary dictionary];
    self.producers = [NSMutableDictionary dictionary];
    self.cameraOn = YES;
    self.microphoneOn = YES;

    
    NSLog(@"conference id:%@", self.channelID);
    
    [[UIApplication sharedApplication] setIdleTimerDisabled:YES];
    
    if (![self isHeadsetPluggedIn] && ![self isLoudSpeaker]) {
        NSError* error;
        [[AVAudioSession sharedInstance] overrideOutputAudioPort:AVAudioSessionPortOverrideSpeaker error:&error];
    }
    
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(didSessionRouteChange:) name:AVAudioSessionRouteChangeNotification object:nil];

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
                        action:@selector(onMute:)
              forControlEvents:UIControlEventTouchUpInside];
    [self.view addSubview:self.muteButton];
    
    [self.muteButton mas_makeConstraints:^(MASConstraintMaker *make) {
        make.centerX.equalTo(self.view.mas_right).with.multipliedBy(0.25);
        make.size.mas_equalTo(CGSizeMake(42, 42));
        make.bottom.equalTo(self.view.mas_bottom).with.offset(-95);
    }];
    
    UIButton *cameraButton = [[UIButton alloc] init];
    self.cameraButton = cameraButton;
    [self.cameraButton setImage:[UIImage imageNamed:@"switch"] forState:UIControlStateNormal];
    [self.cameraButton addTarget:self
                          action:@selector(toggleCamera:)
                forControlEvents:UIControlEventTouchUpInside];
    [self.view addSubview:self.cameraButton];
    
    [self.cameraButton mas_makeConstraints:^(MASConstraintMaker *make) {
        make.centerX.equalTo(self.view.mas_right).with.multipliedBy(0.75);
        make.size.mas_equalTo(CGSizeMake(42, 42));
        make.bottom.equalTo(self.view.mas_bottom).with.offset(-95);
    }];
    
    UILabel *durationLabel = [[UILabel alloc] init];
    self.durationLabel = durationLabel;
    [self.durationLabel setFont:[UIFont systemFontOfSize:23.0f]];
    [self.durationLabel setTextAlignment:NSTextAlignmentCenter];
    [self.durationLabel setText:@"000:000"];
    [self.durationLabel setTextColor:[UIColor whiteColor]];
    [self.durationLabel sizeToFit];
    [self.durationLabel setBackgroundColor:[UIColor clearColor]];
    [self.view addSubview:self.durationLabel];
    
    [self.durationLabel mas_makeConstraints:^(MASConstraintMaker *make) {
        make.bottom.equalTo(self.hangUpButton.mas_top).with.offset(-20);
        make.centerX.equalTo(self.view.mas_centerX);
    }];

    
    NSURL *jsCodeLocation = [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index.ios"
                                                                           fallbackResource:nil];
    
    
    RCTBridge *bridge = [[RCTBridge alloc] initWithBundleURL:jsCodeLocation
                                              moduleProvider:nil
                                               launchOptions:nil];

    self.bridge = bridge;
    
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(onReactDidLoad:) name:RCTJavaScriptDidLoadNotification object:nil];
    
}


-(void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

-(void)onReactDidLoad:(id)obj {
    NSLog(@"on react did load");
    [self requestPermission];
}


-(void)hangUp:(id)sender {
    RoomModule *roomModule = [self.bridge moduleForClass:[RoomModule class]];
    [roomModule leaveRoom:self.channelID];
    dispatch_time_t time = dispatch_time(DISPATCH_TIME_NOW, 1ull * NSEC_PER_SEC);
    dispatch_after(time, dispatch_get_main_queue(), ^{
        NSLog(@" waited at lease three seconds");
        [self dismissViewControllerAnimated:YES completion:nil];

    });
}

-(void)onMute:(id)sender {
    self.microphoneOn = !self.microphoneOn;
    [self.roomModule muteMicrophone:!self.microphoneOn];
    if (self.microphoneOn) {
        [self.muteButton setImage:[UIImage imageNamed:@"unmute"] forState:UIControlStateNormal];
    } else {
        [self.muteButton setImage:[UIImage imageNamed:@"mute"] forState:UIControlStateNormal];
    }
}

-(void)toggleCamera:(id)sender {
    self.cameraOn = !self.cameraOn;
    [self.roomModule toogleCamera:self.cameraOn];
}

-(void)switchCamera:(id)sender {
    Producer *producer = nil;
    NSArray *producers = [self.producers allValues];
    for (NSInteger i = 0; i < producers.count; i++) {
        Producer *p = [producers objectAtIndex:i];
        if ([p.kind isEqualToString:@"video"]) {
            producer = p;
            break;
        }
    }
    if (!producer) {
        return;
    }
    if([producer.type isEqualToString:@"front"]) {
        producer.type = @"back";
    } else {
        producer.type = @"front";
    }
    
    self.localVideoView.mirror = [producer.type isEqualToString:@"front"];
    [self.roomModule switchCamera];
    
}

- (void)requestPermission {
    AVAuthorizationStatus authStatus = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeVideo];
    if(authStatus == AVAuthorizationStatusAuthorized) {
        
    } else if(authStatus == AVAuthorizationStatusDenied){
        // denied
    } else if(authStatus == AVAuthorizationStatusRestricted){
        // restricted, normally won't happen
    } else if(authStatus == AVAuthorizationStatusNotDetermined){
        [AVCaptureDevice requestAccessForMediaType:AVMediaTypeVideo completionHandler:^(BOOL granted) {
            if(granted){
                AVAuthorizationStatus audioAuthStatus = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio];
                if (audioAuthStatus != AVAuthorizationStatusNotDetermined) {
                    [self startup];
                }
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
                AVAuthorizationStatus authStatus = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeVideo];
                if (authStatus != AVAuthorizationStatusNotDetermined) {
                    [self startup];
                }
            } else {
                NSLog(@"Not granted access to %@", AVMediaTypeAudio);
            }
        }];
    }

    if (authStatus != AVAuthorizationStatusNotDetermined && audioAuthStatus != AVAuthorizationStatusNotDetermined) {
        [self startup];
    }
}


-(void)startup {
    RoomModule *roomModule = [self.bridge moduleForClass:[RoomModule class]];
    roomModule.delegate = self;
    
    [self createLocalParticipant];
    
    NSString *peerId = [NSString stringWithFormat:@"%lld", self.currentUID];
    [roomModule joinRoom:self.channelID peerId:peerId name:@""];
}

-(void)createLocalParticipant {
    WebRTCVideoView *videoView = [[WebRTCVideoView alloc] initWithFrame:CGRectZero];
    videoView.objectFit = WebRTCVideoViewObjectFitCover;
    videoView.clipsToBounds = YES;
    
    UITapGestureRecognizer* singleTap = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(switchCamera:)];
    [videoView addGestureRecognizer:singleTap];

    CGFloat w = self.view.frame.size.width/2;
    CGFloat h = w;
    CGFloat y = h*(self.peers.count/2);
    CGFloat x = w*(self.peers.count%2);
    videoView.frame = CGRectMake(x, y, w, h);
    [self.scrollView addSubview:videoView];
    
    UIView *blackView = [[UIView alloc] init];
    blackView.backgroundColor = [UIColor blackColor];
    blackView.frame = CGRectMake(x, y, w, h);
    blackView.hidden = YES;
    [self.scrollView addSubview:blackView];

    NSInteger count = self.peers.count + 1;//include local;
    self.scrollView.contentSize = CGSizeMake(w*2, h*(count%2+count/2));
    
    self.localVideoView = videoView;
    self.blackMask = blackView;
}

-(void)createRemoteParticipant:(NSString*)peerId name:(NSString*)displayName {
    WebRTCVideoView *videoView = [[WebRTCVideoView alloc] initWithFrame:CGRectZero];
    videoView.objectFit = WebRTCVideoViewObjectFitCover;
    videoView.clipsToBounds = YES;
    
    NSInteger count = self.peers.count + 1;//include local;
    CGFloat w = self.view.frame.size.width/2;
    CGFloat h = w;
    CGFloat y = h*(count/2);
    CGFloat x = w*(count%2);
    videoView.frame = CGRectMake(x, y, w, h);
    
    [self.scrollView addSubview:videoView];
    
    Peer *p = [[Peer alloc] init];
    p.id = peerId;
    p.displayName = displayName;
    p.videoView = videoView;
    [self.peers addObject:p];
    [self.peersDict setValue:p forKey:peerId];

    count = self.peers.count + 1;
    self.scrollView.contentSize = CGSizeMake(w*2, h*(count%2+count/2));
}


-(void)onRoomState:(NSString*)state {
    NSLog(@"room state:%@", state);
}
-(void)onNewPeer:(NSString*)peerId name:(NSString*)displayName {
    NSLog(@"on new peer:%@", peerId);

    if ([self.peersDict objectForKey:peerId]) {
        NSLog(@"peer id:%@ exists", peerId);
        return;
    }

    [self createRemoteParticipant:peerId name:displayName];
}

-(void)onPeerClosed:(NSString*)peerId {
    NSLog(@"on peer closed:%@", peerId);
    if (![self.peersDict objectForKey:peerId]) {
        NSLog(@"peer id:%@ nonexists", peerId);
        return;
    }
    Peer *peer = [self.peersDict objectForKey:peerId];
    [self.peers removeObject:peer];
    [self.peersDict removeObjectForKey:peerId];
    //self.peersDict

    [peer.videoView removeFromSuperview];
    
    //layout peers
    for (NSInteger i = 0; i < self.peers.count; i++) {
        NSInteger viewIndex = i+1;//include local;
        Peer *p = [self.peers objectAtIndex:i];
        CGFloat w = self.view.frame.size.width/2;
        CGFloat h = w;
        CGFloat y = h*(viewIndex/2);
        CGFloat x = w*(viewIndex%2);
        p.videoView.frame = CGRectMake(x, y, w, h);
    }
    
    CGFloat w = self.view.frame.size.width/2;
    CGFloat h = w;
    
    NSInteger count = self.peers.count + 1;
    self.scrollView.contentSize = CGSizeMake(w, h*(count%2+count/2));
}

-(void)onAddProducer:(Producer*)producer {
    NSLog(@"on add producer:%@ %@", producer.id, producer.kind);
    
    if ([producer.kind isEqualToString:@"video"]) {
        WebRTCModule *module = [self.bridge moduleForClass:[WebRTCModule class]];
        dispatch_async(module.workerQueue, ^{
            RTCMediaStream *stream = [module streamForReactTag:producer.streamURL];
            NSArray *videoTracks = stream ? stream.videoTracks : @[];
            RTCVideoTrack *videoTrack = [videoTracks firstObject];
            if (!videoTrack) {
                RCTLogWarn(@"No video stream for react tag: %@", producer.streamURL);
            } else {
                dispatch_async(dispatch_get_main_queue(), ^{
                    [videoTrack addRenderer:self.localVideoView];
                    self.blackMask.hidden = YES;
                });
            }
        });
    }
    [self.producers setValue:producer forKey:producer.id];
}

-(void)onRemoveProducer:(NSString*)producerId {
    NSLog(@"on remove producer:%@", producerId);
    Producer *producer = [self.producers objectForKey:producerId];
    if (!producer) {
        return;
    }
    if ([producer.kind isEqualToString:@"video"]) {
        WebRTCModule *module = [self.bridge moduleForClass:[WebRTCModule class]];
        dispatch_async(module.workerQueue, ^{
            RTCMediaStream *stream = [module streamForReactTag:producer.streamURL];
            NSArray *videoTracks = stream ? stream.videoTracks : @[];
            RTCVideoTrack *videoTrack = [videoTracks firstObject];
            if (!videoTrack) {
                RCTLogWarn(@"No video stream for react tag: %@", producer.streamURL);
            } else {
                dispatch_async(dispatch_get_main_queue(), ^{
                    [videoTrack removeRenderer:self.localVideoView];
                    self.blackMask.hidden = NO;
                });
            }
        });
    }
    [self.producers removeObjectForKey:producerId];
}

-(void)onAddConsumer:(Consumer*)consumer peerId:(NSString*)peerId {
    NSLog(@"on add consumer:%@ %@--:%@", consumer.id, consumer.kind, peerId);
    if (![self.peersDict objectForKey:peerId]) {
        NSLog(@"peer id:%@ nonexists", peerId);
        return;
    }
    Peer *peer = [self.peersDict objectForKey:peerId];
    if (![peer.consumers objectForKey:consumer.id]) {
        [peer.consumers setObject:consumer forKey:consumer.id];
        if ([consumer.kind isEqualToString:@"video"]) {
            WebRTCModule *module = [self.bridge moduleForClass:[WebRTCModule class]];
            dispatch_async(module.workerQueue, ^{
                RTCMediaStream *stream = [module streamForReactTag:consumer.streamURL];
                NSArray *videoTracks = stream ? stream.videoTracks : @[];
                RTCVideoTrack *videoTrack = [videoTracks firstObject];
                if (!videoTrack) {
                    RCTLogWarn(@"No video stream for react tag: %@", consumer.streamURL);
                } else {
                    dispatch_async(dispatch_get_main_queue(), ^{
                        [videoTrack addRenderer:peer.videoView];
                    });
                }
            });
        }
    }
    
}
-(void)onConsumerClosed:(NSString*)consumerId peerId:(NSString*)peerId {
    NSLog(@"on consumer closed:%@--%@", consumerId, peerId);
    if (![self.peersDict objectForKey:peerId]) {
        NSLog(@"peer id:%@ nonexists", peerId);
        return;
    }
    Peer *peer = [self.peersDict objectForKey:peerId];
    if ([peer.consumers objectForKey:consumerId]) {
        Consumer *consumer = [peer.consumers objectForKey:consumerId];
        if ([consumer.kind isEqualToString:@"video"]) {
            WebRTCModule *module = [self.bridge moduleForClass:[WebRTCModule class]];
            dispatch_async(module.workerQueue, ^{
                RTCMediaStream *stream = [module streamForReactTag:consumer.streamURL];
                NSArray *videoTracks = stream ? stream.videoTracks : @[];
                RTCVideoTrack *videoTrack = [videoTracks firstObject];
                if (!videoTrack) {
                    RCTLogWarn(@"No video stream for react tag: %@", consumer.streamURL);
                } else {
                    dispatch_async(dispatch_get_main_queue(), ^{
                        [videoTrack removeRenderer:peer.videoView];
                    });
                }
            });
        }
        [peer.consumers removeObjectForKey:consumerId];
    }
    
}
-(void)onConsumerPaused:(NSString*)consumerId peerId:(NSString*)peerId originator:(NSString*)originator {
    NSLog(@"on consumer paused:%@--%@--%@", consumerId, peerId, originator);
    
    if (![self.peersDict objectForKey:peerId]) {
        NSLog(@"peer id:%@ nonexists", peerId);
        return;
    }
    Peer *peer = [self.peersDict objectForKey:peerId];
    if ([peer.consumers objectForKey:consumerId]) {
        Consumer *consumer = [peer.consumers objectForKey:consumerId];
        consumer.paused = YES;
    }
}

-(void)onConsumerResumed:(NSString*)consumerId peerId:(NSString*)peerId originator:(NSString*)originator {
    NSLog(@"on consumer resumed:%@--%@--%@", consumerId, peerId, originator);
    
    if (![self.peersDict objectForKey:peerId]) {
        NSLog(@"peer id:%@ nonexists", peerId);
        return;
    }
    Peer *peer = [self.peersDict objectForKey:peerId];
    if ([peer.consumers objectForKey:consumerId]) {
        Consumer *consumer = [peer.consumers objectForKey:consumerId];
        consumer.paused = NO;
    }
    
}


- (void)didSessionRouteChange:(NSNotification *)notification {
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

@end
