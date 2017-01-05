//
//  ConferenceViewController.h
//  Face
//
//  Created by houxh on 2016/12/7.
//  Copyright © 2016年 beetle. All rights reserved.
//

#import <UIKit/UIKit.h>

@interface ConferenceViewController : UIViewController

+(int64_t)controllerCount;

@property(nonatomic, assign) int64_t currentUID;
@property(nonatomic, assign) int64_t initiator;//会议发起人
@property(nonatomic, copy) NSString *channelID;

//3者必须同样大小，且顺序一致
@property(nonatomic) NSArray *partipants;//参会者id
@property(nonatomic) NSArray *partipantNames;
@property(nonatomic) NSArray *partipantAvatars;
@end
