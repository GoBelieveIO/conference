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
#import <imsdk/IMService.h>
#import "AppDelegate.h"
#import "ConferenceCommand.h"




static int64_t g_controllerCount = 0;

@interface GroupVOIPViewController ()<RCTBridgeModule>
@property(nonatomic, weak) RCTBridge *bridge;
@end

@implementation GroupVOIPViewController
RCT_EXPORT_MODULE();


RCT_EXPORT_METHOD(dismiss) {
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
    

    NSDictionary *props = @{@"name":@"testios",
                            @"room":@"2000"};

    
    RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge moduleName:@"GroupCall" initialProperties:props];
    
    // Set a background color which is in accord with the JavaScript and Android
    // parts of the application and causes less perceived visual flicker than the
    // default background color.
    rootView.backgroundColor = [[UIColor alloc] initWithRed:.07f green:.07f blue:.07f alpha:1];

    self.view = rootView;
    self.bridge = bridge;

    
    [[UIApplication sharedApplication] setIdleTimerDisabled:YES];
    
    
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



- (void)didReceiveMemoryWarning {
    [super didReceiveMemoryWarning];
    // Dispose of any resources that can be recreated.
}

@end
