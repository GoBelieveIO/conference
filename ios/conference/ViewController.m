/*                                                                            
  Copyright (c) 2014-2015, GoBelieve     
    All rights reserved.		    				     			
 
  This source code is licensed under the BSD-style license found in the
  LICENSE file in the root directory of this source tree. An additional grant
  of patent rights can be found in the PATENTS file in the same directory.
*/

#import "ViewController.h"
#import "MBProgressHUD.h"
#import "GroupVOIPViewController.h"
#import "RoomViewController.h"


@interface ViewController ()
@property (weak, nonatomic)  UITextField *myTextField2;
@property (weak, nonatomic)  UITextField *conferenceTextField;
@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];

    
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
    
    
    self.navigationController.navigationBarHidden = YES;
}


-(void)tapAction:(id)sender{
    [self.myTextField2 resignFirstResponder];
    [self.conferenceTextField resignFirstResponder];
}


- (void)enterRoom:(id)sender {
    [self.myTextField2 resignFirstResponder];
    [self.conferenceTextField resignFirstResponder];
    
    int64_t myUID = [self.myTextField2.text longLongValue];
    NSString *conferenceID = self.conferenceTextField.text;
    if (myUID == 0 || conferenceID.length == 0) {
        return;
    }
    
    MBProgressHUD *hud = [MBProgressHUD showHUDAddedTo:self.view animated:NO];
    hud.label.text = @"登录中...";
    
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSString *token = [self login:myUID];
        NSLog(@"token:%@", token);
        dispatch_async(dispatch_get_main_queue(), ^{
            [hud hideAnimated:NO];
            
            if (token.length == 0) {
                return;
            }
            
#ifdef RN
            GroupVOIPViewController *controller = [[GroupVOIPViewController alloc] init];
            controller.currentUID = myUID;
            controller.channelID = conferenceID;
            controller.token = token;
            controller.modalPresentationStyle = UIModalPresentationFullScreen;
            [self presentViewController:controller animated:YES completion:nil];
#else
            RoomViewController *controller = [[RoomViewController alloc] init];
            controller.currentUID = myUID;
            controller.channelID = conferenceID;
            controller.token = token;
            controller.modalPresentationStyle = UIModalPresentationFullScreen;
            [self presentViewController:controller animated:YES completion:nil];
#endif
        });
    });
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




@end
