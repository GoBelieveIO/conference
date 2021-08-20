//
//  RoomModule.m
//  conference
//
//  Created by houxh on 2021/8/20.
//  Copyright © 2021 beetle. All rights reserved.
//

#import "RoomModule.h"

@implementation Producer

@end

@implementation Consumer

@end


@implementation RoomModule
RCT_EXPORT_MODULE();

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

-(NSArray*)supportedEvents {
    return @[@"join_room", @"leave_room"];
}

RCT_EXPORT_METHOD(postRoomState:(NSString *)state)
{
    NSLog(@"room state:%@", state);
    [self.delegate onRoomState:state];
}

RCT_EXPORT_METHOD(postNewPeer:(NSDictionary*)peer)
{
    NSString *peerId = [peer objectForKey:@"id"];
    NSString *displayName = [peer objectForKey:@"displayName"];
    [self.delegate onNewPeer:peerId name:displayName];
}

RCT_EXPORT_METHOD(postPeerClosed:(NSString*)peerId)
{
    [self.delegate onPeerClosed:peerId];
}

RCT_EXPORT_METHOD(postAddProducer:(NSDictionary*)params)
{
    Producer *producer = [[Producer alloc] init];
    producer.id = [params objectForKey:@"id"];
    producer.deviceLabel = [params objectForKey:@"deviceLabel"];
    producer.type = [params objectForKey:@"type"];
    producer.codec = [params objectForKey:@"codec"];
    producer.streamURL = [params objectForKey:@"streamURL"];
    producer.kind = [params objectForKey:@"kind"];
    
    [self.delegate onAddProducer:producer];
}

RCT_EXPORT_METHOD(postRemoveProducer:(NSString*)producerId)
{
    [self.delegate onRemoveProducer:producerId];
}

RCT_EXPORT_METHOD(postAddConsumer:(NSDictionary*)params peerId:(NSString*)peerId)
{
    Consumer *consumer = [[Consumer alloc] init];
    consumer.id = [params objectForKey:@"id"];
    consumer.kind = [params objectForKey:@"kind"];
    consumer.streamURL = [params objectForKey:@"streamURL"];
    [self.delegate onAddConsumer:consumer peerId:peerId];
}

RCT_EXPORT_METHOD(postConsumerClosed:(NSString*)consumerId peerId:(NSString*)peerId)
{
    [self.delegate onConsumerClosed:consumerId peerId:peerId];
}

RCT_EXPORT_METHOD(postConsumerPaused:(NSString*)consumerId peerId:(NSString*)peerId originator:(NSString*)originator)
{
    [self.delegate onConsumerPaused:consumerId peerId:peerId originator:originator];
}

RCT_EXPORT_METHOD(postConsumerResumed:(NSString*)consumerId peerId:(NSString*)peerId originator:(NSString*)originator)
{
    [self.delegate onConsumerResumed:consumerId peerId:peerId originator:originator];
}


-(void)joinRoom:(NSString*)roomId peerId:(NSString*)peerId name:(NSString*)name {
    [self sendEventWithName:@"join_room" body:@{@"roomId":roomId, @"peerId":peerId, @"displayName":name}];
}
-(void)leaveRoom:(NSString*)roomId {
    [self sendEventWithName:@"leave_room" body:@{@"roomId":roomId}];
}

-(void)switchCamera {
    [self sendEventWithName:@"switch_camera" body:@{}];
}

-(void)toogleCamera:(BOOL)enabled {
    [self sendEventWithName:@"toggle_video" body:@{@"videoMuted":@(!enabled)}];
}

-(void)muteMicrophone:(BOOL)muted {
    [self sendEventWithName:@"toggle_audio" body:@{@"audioMuted":@(muted)}];
}

@end
