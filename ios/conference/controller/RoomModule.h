//
//  RoomModule.h
//  conference
//
//  Created by houxh on 2021/8/20.
//  Copyright © 2021 beetle. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

NS_ASSUME_NONNULL_BEGIN




@interface Producer : NSObject
@property(nonatomic) NSString *id;
@property(nonatomic) NSString *streamURL;
@property(nonatomic) NSString *kind;
@property(nonatomic) NSString *deviceLabel;

@property(nonatomic) NSString *type;
@property(nonatomic) NSString *codec;
@property(nonatomic) NSString *rtpParameters;
@end

@interface Consumer : NSObject

@property(nonatomic) NSString *id;
@property(nonatomic) NSString *streamURL;
@property(nonatomic) NSString *kind;
@property(nonatomic) NSString *type;
@property(nonatomic, assign) BOOL paused;

@end

@protocol  RoomModuleDelegate <NSObject>

-(void)onRoomState:(NSString*)state;
-(void)onNewPeer:(NSString*)peerId name:(NSString*)displayName;
-(void)onPeerClosed:(NSString*)peerId;
-(void)onAddProducer:(Producer*)producer;
-(void)onRemoveProducer:(NSString*)producerId;
-(void)onAddConsumer:(Consumer*)consumer peerId:(NSString*)peerId;
-(void)onConsumerClosed:(NSString*)consumerId peerId:(NSString*)peerId;
-(void)onConsumerPaused:(NSString*)consumerId peerId:(NSString*)peerId originator:(NSString*)originator;
-(void)onConsumerResumed:(NSString*)consumerId peerId:(NSString*)peerId originator:(NSString*)originator;

@end

@interface RoomModule : RCTEventEmitter<RCTBridgeModule>
@property(nonatomic, weak) id<RoomModuleDelegate> delegate;


-(void)joinRoom:(NSString*)roomId peerId:(NSString*)peerId name:(NSString*)name;
-(void)leaveRoom:(NSString*)roomId;
-(void)switchCamera;
-(void)toogleCamera:(BOOL)enabled;
-(void)muteMicrophone:(BOOL)muted;
    
@end

NS_ASSUME_NONNULL_END
