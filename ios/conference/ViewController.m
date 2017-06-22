/*                                                                            
  Copyright (c) 2014-2015, GoBelieve     
    All rights reserved.		    				     			
 
  This source code is licensed under the BSD-style license found in the
  LICENSE file in the root directory of this source tree. An additional grant
  of patent rights can be found in the PATENTS file in the same directory.
*/

#import "ViewController.h"
#import "MBProgressHUD.h"

#import <imsdk/IMService.h>
#import "ConferenceViewController.h"
#import "ConferenceCommand.h"
#import "GroupVOIPViewController.h"

@interface ViewController ()<RTMessageObserver>
@property (weak, nonatomic)  UITextField *myTextField;
@property (weak, nonatomic)  UITextField *partipantTextField1;
@property (weak, nonatomic)  UITextField *partipantTextField2;
@property (weak, nonatomic)  UITextField *partipantTextField3;
@property (weak, nonatomic)  UITextField *partipantTextField4;

@property (weak, nonatomic)  UITextField *myTextField2;
@property (weak, nonatomic)  UITextField *conferenceTextField;

@property(nonatomic) MBProgressHUD *hud;
@property(nonatomic, copy) NSString *token;

@property(nonatomic) NSMutableArray *channelIDs;

@property(nonatomic, assign) int64_t myUID;

@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    self.channelIDs = [NSMutableArray array];

    [IMService instance].host = @"imnode2.gobelieve.io";
    [IMService instance].deviceID = [[[UIDevice currentDevice] identifierForVendor] UUIDString];
    [[IMService instance] startRechabilityNotifier];
    
    [[IMService instance] addRTMessageObserver:self];
    
    if ([self respondsToSelector:@selector(setEdgesForExtendedLayout:)]) {
        [self setEdgesForExtendedLayout:UIRectEdgeNone];
    }
    
    UITapGestureRecognizer*tapGesture = [[UITapGestureRecognizer alloc]initWithTarget:self action:@selector(tapAction:)];
    [self.view addGestureRecognizer:tapGesture];
    
    UIImageView *bgImageView = [[UIImageView alloc] initWithFrame:self.view.bounds];
    bgImageView.image = [UIImage imageNamed:@"bg"];
    [self.view addSubview:bgImageView];
    
    
    float startHeight = 40;
    UITextField *textField = [[UITextField alloc] initWithFrame:CGRectMake(52, startHeight + 4, 180, 37)];
    self.myTextField2 = textField;
    self.myTextField2.textColor = [UIColor whiteColor];
    self.myTextField2.font = [UIFont systemFontOfSize:18];
    self.myTextField2.placeholder = @"我的id";
    self.myTextField2.keyboardType = UIKeyboardTypeNumberPad;
    [self.view addSubview:self.myTextField2];
    
    startHeight += 48;
    textField = [[UITextField alloc] initWithFrame:CGRectMake(52, startHeight + 4, 180, 37)];
    self.conferenceTextField = textField;
    self.conferenceTextField.textColor = [UIColor whiteColor];
    self.conferenceTextField.font = [UIFont systemFontOfSize:18];
    self.conferenceTextField.placeholder = @"会议id";
    self.conferenceTextField.keyboardType = UIKeyboardTypeNumberPad;
    [self.view addSubview:self.conferenceTextField];
    
    startHeight += 48;
    UIButton *btn = [UIButton buttonWithType:UIButtonTypeCustom];
    btn.frame = CGRectMake(100, startHeight, 120, 48);
    [btn setTitle:@"进入会议室" forState:UIControlStateNormal];
    btn.titleLabel.font = [UIFont systemFontOfSize:17];
    btn.tintColor = [UIColor blackColor];
    btn.backgroundColor = [UIColor redColor];
    
    [btn addTarget:self action:@selector(enterRoom:) forControlEvents:UIControlEventTouchUpInside];
    [self.view addSubview:btn];
    
    
    startHeight += 48;
    textField = [[UITextField alloc] initWithFrame:CGRectMake(52, startHeight, 180, 37)];
    self.myTextField = textField;
    self.myTextField.textColor = [UIColor whiteColor];
    self.myTextField.font = [UIFont systemFontOfSize:18];
    self.myTextField.placeholder = @"我的id";
    self.myTextField.keyboardType = UIKeyboardTypeNumberPad;
    [self.view addSubview:self.myTextField];
    
    
    startHeight += 48;
    textField = [[UITextField alloc] initWithFrame:CGRectMake(52, startHeight + 4, 180, 37)];
    self.partipantTextField1 = textField;
    self.partipantTextField1.textColor = [UIColor whiteColor];
    self.partipantTextField1.font = [UIFont systemFontOfSize:18];
    self.partipantTextField1.placeholder = @"1号参会者";
    self.partipantTextField1.keyboardType = UIKeyboardTypeNumberPad;
    [self.view addSubview:self.partipantTextField1];
    
    startHeight += 48;
    textField = [[UITextField alloc] initWithFrame:CGRectMake(52, startHeight + 4, 180, 37)];
    self.partipantTextField2 = textField;
    self.partipantTextField2.textColor = [UIColor whiteColor];
    self.partipantTextField2.font = [UIFont systemFontOfSize:18];
    self.partipantTextField2.placeholder = @"2号参会者";
    self.partipantTextField2.keyboardType = UIKeyboardTypeNumberPad;
    [self.view addSubview:self.partipantTextField2];
    
    startHeight += 48;
    textField = [[UITextField alloc] initWithFrame:CGRectMake(52, startHeight + 4, 180, 37)];
    self.partipantTextField3 = textField;
    self.partipantTextField3.textColor = [UIColor whiteColor];
    self.partipantTextField3.font = [UIFont systemFontOfSize:18];
    self.partipantTextField3.placeholder = @"3号参会者";
    self.partipantTextField3.keyboardType = UIKeyboardTypeNumberPad;
    [self.view addSubview:self.partipantTextField3];
    
    startHeight += 48;
    textField = [[UITextField alloc] initWithFrame:CGRectMake(52, startHeight + 4, 180, 37)];
    self.partipantTextField4 = textField;
    self.partipantTextField4.textColor = [UIColor whiteColor];
    self.partipantTextField4.font = [UIFont systemFontOfSize:18];
    self.partipantTextField4.placeholder = @"4号参会者";
    self.partipantTextField4.keyboardType = UIKeyboardTypeNumberPad;
    [self.view addSubview:self.partipantTextField4];
    

    startHeight += 60;
    btn  = [[UIButton alloc] initWithFrame:CGRectMake(10, startHeight, 120, 48)];
    [btn setTitle:@"邀请" forState:UIControlStateNormal];
    btn.titleLabel.font = [UIFont systemFontOfSize:17];
    btn.tintColor = [UIColor blackColor];
    
    btn.backgroundColor = [UIColor redColor];
    [btn addTarget:self action:@selector(dial:) forControlEvents:UIControlEventTouchUpInside];
    [self.view addSubview:btn];
    

    btn = [UIButton buttonWithType:UIButtonTypeCustom];
    btn.frame = CGRectMake(190, startHeight, 120, 48);
    [btn setTitle:@"等待" forState:UIControlStateNormal];
    btn.titleLabel.font = [UIFont systemFontOfSize:17];
    btn.tintColor = [UIColor blackColor];
    btn.backgroundColor = [UIColor redColor];
    
    [btn addTarget:self action:@selector(receiveCall:) forControlEvents:UIControlEventTouchUpInside];
    [self.view addSubview:btn];
    

    
    
    
    self.navigationController.navigationBarHidden = YES;
}


-(void)tapAction:(id)sender{
    [self.myTextField resignFirstResponder];

    [self.partipantTextField1 resignFirstResponder];
    [self.partipantTextField2 resignFirstResponder];
    [self.partipantTextField3 resignFirstResponder];
    [self.partipantTextField4 resignFirstResponder];
    
    [self.myTextField2 resignFirstResponder];
    [self.conferenceTextField resignFirstResponder];
}


- (void)enterRoom:(id)sender {
    [self.myTextField2 resignFirstResponder];
    [self.conferenceTextField resignFirstResponder];
    
//    int64_t myUID = [self.myTextField2.text longLongValue];
//    NSString *conferenceID = self.conferenceTextField.text;
//    if (myUID == 0 || conferenceID.length == 0) {
//        return;
//    }
    
    int64_t myUID = 1;
    NSString *conferenceID = @"1000";
    
    self.hud = [MBProgressHUD showHUDAddedTo:self.view animated:NO];
    self.hud.label.text = @"登录中...";
    
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSString *token = [self login:myUID];
        NSLog(@"token:%@", token);
        dispatch_async(dispatch_get_main_queue(), ^{
            [IMService instance].token = token;
            [[IMService instance] start];
            self.token = token;
            [self.hud hideAnimated:NO];
            
            GroupVOIPViewController *controller = [[GroupVOIPViewController alloc] init];
            
            controller.currentUID = myUID;
            controller.channelID = conferenceID;
            
            [self presentViewController:controller animated:YES completion:nil];
        });
    });
}


- (void)dial:(id)sender {
    [self.myTextField resignFirstResponder];
    [self.conferenceTextField resignFirstResponder];
    [self.partipantTextField1 resignFirstResponder];
    [self.partipantTextField2 resignFirstResponder];
    [self.partipantTextField3 resignFirstResponder];
    [self.partipantTextField4 resignFirstResponder];
    
    int64_t myUID = [self.myTextField.text longLongValue];
    int64_t p1 = [self.partipantTextField1.text longLongValue];
    int64_t p2 = [self.partipantTextField2.text longLongValue];
    int64_t p3 = [self.partipantTextField3.text longLongValue];
    int64_t p4 = [self.partipantTextField4.text longLongValue];
    
    if (myUID == 0) {
        return;
    }
    
    NSMutableArray *partipantAvatars = [NSMutableArray array];
    NSMutableArray *partipantNames = [NSMutableArray array];
    NSMutableArray *partipants = [NSMutableArray array];
    [partipants addObject:[NSNumber numberWithLongLong:myUID]];
    [partipantNames addObject:@""];
    [partipantAvatars addObject:@""];
    
    if (p1) {
        [partipants addObject:[NSNumber numberWithLongLong:p1]];
        [partipantNames addObject:@""];
        [partipantAvatars addObject:@""];
    }
    if (p2) {
        [partipants addObject:[NSNumber numberWithLongLong:p2]];
        [partipantNames addObject:@""];
        [partipantAvatars addObject:@""];
    }
    if (p3) {
        [partipants addObject:[NSNumber numberWithLongLong:p3]];
        [partipantNames addObject:@""];
        [partipantAvatars addObject:@""];
    }
    if (p4) {
        [partipants addObject:[NSNumber numberWithLongLong:p4]];
        [partipantNames addObject:@""];
        [partipantAvatars addObject:@""];
    }

    if (partipants.count <= 1) {
        return;
    }
    
    self.hud = [MBProgressHUD showHUDAddedTo:self.view animated:NO];
    self.hud.label.text = @"登录中...";

    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSString *token = [self login:myUID];
        NSLog(@"token:%@", token);
        dispatch_async(dispatch_get_main_queue(), ^{
            [IMService instance].token = token;
            [[IMService instance] start];
            self.token = token;
            [self.hud hideAnimated:NO];
            

            ConferenceViewController *controller = [[ConferenceViewController alloc] init];
            
            controller.currentUID = myUID;
            controller.channelID = [[NSUUID UUID] UUIDString];
            controller.initiator = myUID;
            controller.partipants = partipants;
            controller.partipantAvatars = partipantAvatars;
            controller.partipantNames = partipantNames;
       
            [self presentViewController:controller animated:YES completion:nil];
        });
    });
}

- (IBAction)receiveCall:(id)sender {
    [self.myTextField resignFirstResponder];
    [self.conferenceTextField resignFirstResponder];
    [self.partipantTextField1 resignFirstResponder];
    [self.partipantTextField2 resignFirstResponder];
    [self.partipantTextField3 resignFirstResponder];
    [self.partipantTextField4 resignFirstResponder];
    
    int64_t myUID = [self.myTextField.text longLongValue];
    if (myUID == 0) {
        return;
    }

    self.hud = [MBProgressHUD showHUDAddedTo:self.view animated:NO];
    self.hud.label.text = @"登录中...";
    
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSString *token = [self login:myUID];
        NSLog(@"token:%@", token);
        dispatch_async(dispatch_get_main_queue(), ^{
            [IMService instance].token = token;
            [[IMService instance] start];
            self.token = token;
            
            self.hud.label.text = @"等待中...";
            
            self.myUID = myUID;
        });
    });
}

- (void)onRTMessage:(RTMessage *)rt {
    NSData *data = [rt.content dataUsingEncoding:NSUTF8StringEncoding];
    NSError *error = nil;
    NSDictionary *dict = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
    
    NSDictionary *obj = [dict objectForKey:@"conference"];
    if (!obj) {
        return;
    }
    ConferenceCommand *command = [[ConferenceCommand alloc] initWithDictionary:obj];
    
    if ([self.channelIDs containsObject:command.channelID]) {
        return;
    }
    
    if ([ConferenceViewController controllerCount] > 0) {
        return;
    }
    
    if ([command.command isEqualToString:CONFERENCE_COMMAND_INVITE]) {
        [self.hud hideAnimated:NO];
        
        [self.channelIDs addObject:command.channelID];
        
        NSMutableArray *partipantNames = [NSMutableArray array];
        NSMutableArray *partipantAvatars = [NSMutableArray array];
        for (int i = 0; i < command.partipants.count; i++) {
            [partipantNames addObject:@""];
            [partipantAvatars addObject:@""];
        }
        
        ConferenceViewController *controller = [[ConferenceViewController alloc] init];
        
        controller.currentUID = self.myUID;
        controller.channelID = command.channelID;
        controller.initiator = command.initiator;
        controller.partipants = command.partipants;
        controller.partipantNames = partipantNames;
        controller.partipantAvatars = partipantAvatars;
        
        [self presentViewController:controller animated:YES completion:nil];
    }

}

-(NSString*)login:(long long)uid {
    //调用app自身的登陆接口获取voip服务必须的access token
    //sandbox地址："http://sandbox.demo.gobelieve.io/auth/token"
    NSString *url = @"http://demo.gobelieve.io/auth/token";
    NSMutableURLRequest *urlRequest = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:url]
                                                              cachePolicy:NSURLRequestUseProtocolCachePolicy
                                                          timeoutInterval:60];
    
    
    [urlRequest setHTTPMethod:@"POST"];
    
    NSDictionary *headers = [NSDictionary dictionaryWithObject:@"application/json" forKey:@"Content-Type"];
    
    [urlRequest setAllHTTPHeaderFields:headers];
    
    
    NSDictionary *obj = [NSDictionary dictionaryWithObject:[NSNumber numberWithLongLong:uid] forKey:@"uid"];
    NSData *postBody = [NSJSONSerialization dataWithJSONObject:obj options:0 error:nil];
    
    [urlRequest setHTTPBody:postBody];
    
    NSURLResponse *response = nil;
    
    NSError *error = nil;
    
    NSData *data = [NSURLConnection sendSynchronousRequest:urlRequest returningResponse:&response error:&error];
    if (error != nil) {
        NSLog(@"error:%@", error);
        return nil;
    }
    NSHTTPURLResponse *httpResp = (NSHTTPURLResponse*)response;
    if (httpResp.statusCode != 200) {
        return nil;
    }
    NSDictionary *e = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableLeaves error:nil];
    return [e objectForKey:@"token"];
}



- (void)didReceiveMemoryWarning {
    [super didReceiveMemoryWarning];
    // Dispose of any resources that can be recreated.
}

@end
