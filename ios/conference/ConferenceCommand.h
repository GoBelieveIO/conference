//
//  ConferenceCommand.h
//  conference
//
//  Created by houxh on 2016/12/25.
//  Copyright © 2016年 beetle. All rights reserved.
//

#import <Foundation/Foundation.h>


#define CONFERENCE_COMMAND_INVITE  @"invite"
#define CONFERENCE_COMMAND_WAIT  @"waiting"
#define CONFERENCE_COMMAND_ACCEPT  @"accept"
#define CONFERENCE_COMMAND_REFUSE  @"refuse"

@interface ConferenceCommand : NSObject

@property(nonatomic, assign) int64_t initiator;
@property(nonatomic, copy) NSString *channelID;
@property(nonatomic) NSArray *partipants;
@property(nonatomic, copy) NSString *command;

-(ConferenceCommand*)initWithDictionary:(NSDictionary*)dict;
-(NSDictionary*)jsonDictionary;

@end
