//
//  ConferenceViewController.m
//  Face
//
//  Created by houxh on 2016/12/7.
//  Copyright © 2016年 beetle. All rights reserved.
//

#import "ConferenceViewController.h"
#import "RCTBundleURLProvider.h"
#import "RCTRootView.h"

#import "RCTBridgeModule.h"
#import "RCTBridge.h"
#import "RCTEventDispatcher.h"
#import <AVFoundation/AVFoundation.h>
#import <imsdk/IMService.h>
#import "AppDelegate.h"
#import "ConferenceCommand.h"

#define CONFERENCE_STATE_WAITING 1
#define CONFERENCE_STATE_ACCEPTED 2
#define CONFERENCE_STATE_REFUSED 3


static int64_t g_controllerCount = 0;

@interface ConferenceViewController ()<RCTBridgeModule, RTMessageObserver>
@property(nonatomic) NSTimer *timer;
//当前用户是主叫方， 表示被叫方接听的状态 接受/拒绝／等待应答
@property(nonatomic) NSMutableDictionary *partipantStates;
//当前用户是被叫方,接听的状态 接受/拒绝／等待应答
@property(nonatomic) int state;

@property(nonatomic, weak) RCTBridge *bridge;
@end

@implementation ConferenceViewController
RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(accept) {
    self.state = CONFERENCE_STATE_ACCEPTED;
    [self sendAccept];
}

RCT_EXPORT_METHOD(refuse) {
    self.state = CONFERENCE_STATE_REFUSED;
    [self sendRefuse];
}

RCT_EXPORT_METHOD(dismiss) {
    [self.timer invalidate];

    [[IMService instance] removeRTMessageObserver:self];
    
    [[UIApplication sharedApplication] setIdleTimerDisabled:NO];
    
    RCTRootView *rootView = (RCTRootView*)self.view;
    [rootView.bridge invalidate];
    [self dismissViewControllerAnimated:YES completion:nil];
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


- (dispatch_queue_t)methodQueue {
    return dispatch_get_main_queue();
}


-(void)dealloc {
    g_controllerCount--;
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)viewDidLoad {
    [super viewDidLoad];
    g_controllerCount++;
    
    __weak ConferenceViewController *wself = self;
    RCTBridgeModuleProviderBlock provider = ^NSArray<id<RCTBridgeModule>> *{
        return @[wself];
    };
    
    NSLog(@"channel id:%@", self.channelID);
    
    NSURL *jsCodeLocation = [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index.ios"
                                                                           fallbackResource:nil];
    
    
    RCTBridge *bridge = [[RCTBridge alloc] initWithBundleURL:jsCodeLocation
                                              moduleProvider:provider
                                               launchOptions:nil];
    
    NSMutableArray *users = [NSMutableArray array];
    for (int i = 0; i < self.partipants.count; i++) {
        NSNumber *uid = [self.partipants objectAtIndex:i];
        NSString *name = [self.partipantNames objectAtIndex:i];
        NSString *avatar = [self.partipantAvatars objectAtIndex:i];
        
        NSDictionary *user = @{@"uid":uid,
                               @"name":name,
                               @"avatar":avatar};
        [users addObject:user];
    }
    
    BOOL isInitiator = (self.currentUID == self.initiator);
    
    NSDictionary *props = @{@"initiator":[NSNumber numberWithLongLong:self.initiator],
                            @"isInitiator":[NSNumber numberWithBool:isInitiator],
                            @"channelID":self.channelID,
                            @"partipants":users};
    
    RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge moduleName:@"App" initialProperties:props];
    
    // Set a background color which is in accord with the JavaScript and Android
    // parts of the application and causes less perceived visual flicker than the
    // default background color.
    rootView.backgroundColor = [[UIColor alloc] initWithRed:.07f green:.07f blue:.07f alpha:1];

    self.view = rootView;
    self.bridge = bridge;
    
    [[IMService instance] addRTMessageObserver:self];

    [[UIApplication sharedApplication] setIdleTimerDisabled:YES];
    
    if (isInitiator) {
        self.partipantStates = [NSMutableDictionary dictionary];
        for (int i = 0; i < self.partipants.count; i++) {
            NSNumber *uid = [self.partipants objectAtIndex:i];
            if (self.currentUID == [uid longLongValue]) {
                continue;
            }
            [self.partipantStates setObject:[NSNumber numberWithInt:CONFERENCE_STATE_WAITING] forKey:uid];
        }
        self.timer = [NSTimer scheduledTimerWithTimeInterval:1 repeats:YES block:^(NSTimer * _Nonnull timer) {
            [self sendInvite];
        }];
        [self sendInvite];
    } else {
        self.state = CONFERENCE_STATE_WAITING;
    }
    
    
    if (![self isHeadsetPluggedIn] && ![self isLoudSpeaker]) {
        NSError* error;
        [[AVAudioSession sharedInstance] overrideOutputAudioPort:AVAudioSessionPortOverrideSpeaker error:&error];
    }
    
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(didSessionRouteChange:) name:AVAudioSessionRouteChangeNotification object:nil];
    
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



-(void)sendRTMessage:(NSString*)command to:(int64_t)to {
    ConferenceCommand *c = [[ConferenceCommand alloc] init];
    c.channelID = self.channelID;
    c.partipants = self.partipants;
    c.initiator = self.initiator;
    c.command = command;
    NSDictionary *dict = @{@"conference":[c jsonDictionary]};

    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:dict options:0 error:nil];
    NSString* newStr = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
    
    RTMessage *rt = [[RTMessage alloc] init];
    rt.sender = self.currentUID;
    rt.receiver = to;
    rt.content = newStr;
    
    NSLog(@"send rt message:%@", rt.content);
    
    [[IMService instance] sendRTMessage:rt];
}


-(void)sendAccept {
    [self sendRTMessage:CONFERENCE_COMMAND_ACCEPT to:self.initiator];
}

-(void)sendRefuse {
    [self sendRTMessage:CONFERENCE_COMMAND_REFUSE to:self.initiator];
}

-(void)sendWaiting {
    [self sendRTMessage:CONFERENCE_COMMAND_WAIT to:self.initiator];
}

-(void)sendInvite:(int64_t)to {
    [self sendRTMessage:CONFERENCE_COMMAND_INVITE to:to];
}

-(void)sendInvite {
    for (int i = 0; i < self.partipants.count; i++) {
        NSNumber *uid = [self.partipants objectAtIndex:i];
        if ([uid longLongValue] == self.currentUID) {
            continue;
        }

        int state = [[self.partipantStates objectForKey:uid] intValue];
        if (state == CONFERENCE_STATE_WAITING) {
            [self sendInvite:[uid longLongValue]];
        }
    }
}

-(void)onRTMessage:(RTMessage*)rt {
    NSNumber *sender = [NSNumber numberWithLongLong:rt.sender];
    if (![self.partipants containsObject:sender]) {
        return;
    }
    
    NSData *data = [rt.content dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *dict = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableLeaves error:nil];
    if (![dict isKindOfClass:[NSDictionary class]]) {
        return;
    }
    if (![dict objectForKey:@"conference"]) {
        return;
    };
    
    NSDictionary *c = [dict objectForKey:@"conference"];

    ConferenceCommand *confCommand = [[ConferenceCommand alloc] initWithDictionary:c];
    NSString *command = confCommand.command;
    NSLog(@"conference command:%@", command);
    BOOL isInitiator = (self.currentUID == self.initiator);
    
    if (isInitiator) {
        if ([command isEqualToString:CONFERENCE_COMMAND_ACCEPT]) {
            [self.partipantStates setObject:[NSNumber numberWithInt:CONFERENCE_STATE_ACCEPTED] forKey:sender];
        } else if ([command isEqualToString:CONFERENCE_COMMAND_REFUSE]) {
            [self.partipantStates setObject:[NSNumber numberWithInt:CONFERENCE_STATE_REFUSED] forKey:sender];
        } else if ([command isEqualToString:CONFERENCE_COMMAND_WAIT]) {
            //等待用户接听
        }

        //所有人都拒绝
        BOOL refused = YES;
        for (int i = 0; i <self.partipants.count; i++) {
            NSNumber *uid = [self.partipants objectAtIndex:i];
            if ([uid longLongValue] == self.currentUID) {
                continue;
            }
            int s = [[self.partipantStates objectForKey:uid] intValue];
            if (s != CONFERENCE_STATE_REFUSED) {
                refused = NO;
                break;
            }
        }
        
        if (refused) {
            [self.bridge.eventDispatcher sendAppEventWithName:@"onRemoteRefuse"
                                                         body:nil];
        }
    } else {
        if ([command isEqualToString:CONFERENCE_COMMAND_INVITE]) {
            if (self.state == CONFERENCE_STATE_WAITING) {
                [self sendWaiting];
            } else if (self.state == CONFERENCE_STATE_ACCEPTED) {
                [self sendAccept];
            } else if (self.state == CONFERENCE_STATE_REFUSED){
                [self sendRefuse];
            }
        }
    }
}

- (void)didReceiveMemoryWarning {
    [super didReceiveMemoryWarning];
    // Dispose of any resources that can be recreated.
}

@end
