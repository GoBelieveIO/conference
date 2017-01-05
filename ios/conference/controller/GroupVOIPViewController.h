//
//  ConferenceViewController.h
//  Face
//
//  Created by houxh on 2016/12/7.
//  Copyright © 2016年 beetle. All rights reserved.
//

#import <UIKit/UIKit.h>

@interface GroupVOIPViewController : UIViewController

+(int64_t)controllerCount;

@property(nonatomic, assign) int64_t currentUID;
@property(nonatomic, copy) NSString *channelID;


@end
