//
//  ConferenceCommand.m
//  conference
//
//  Created by houxh on 2016/12/25.
//  Copyright © 2016年 beetle. All rights reserved.
//

#import "ConferenceCommand.h"

@implementation ConferenceCommand

- (ConferenceCommand*)initWithDictionary:(NSDictionary*)dict {
    self = [super init];
    if (self) {
        self.initiator = [[dict objectForKey:@"initiator"] longLongValue];
        self.command = [dict objectForKey:@"command"];
        self.partipants = [dict objectForKey:@"partipants"];
        self.channelID = [dict objectForKey:@"channel_id"];
    }
    return self;
}

- (NSDictionary*)jsonDictionary {
    return @{@"initiator":[NSNumber numberWithLongLong:self.initiator],
             @"command":self.command,
             @"partipants":self.partipants,
             @"channel_id":self.channelID};

}
@end
