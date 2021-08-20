//
//  RoomViewController.h
//  conference
//
//  Created by houxh on 2021/8/20.
//  Copyright © 2021 beetle. All rights reserved.
//

#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface RoomViewController : UIViewController
@property(nonatomic, assign) int64_t currentUID;
@property(nonatomic, copy) NSString *channelID;
@property(nonatomic, copy) NSString *token;
@end

NS_ASSUME_NONNULL_END
