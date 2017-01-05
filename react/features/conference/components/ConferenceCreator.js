'use strict';

import React, { Component } from 'react';
import {
    AppRegistry,
    StyleSheet,
    Text,
    Image,
    ListView,
    ScrollView,
    TouchableHighlight,
    ActionSheetIOS,
    ToastAndroid,
    Navigator,
    BackAndroid,
    TextInput,
    Alert,
    View,
    Platform
} from 'react-native';

var Toast = require('react-native-toast');

import NavigationBar from 'react-native-navbar';
import { NativeModules } from 'react-native';
import Spinner from 'react-native-loading-spinner-overlay';

var IsAndroid = (Platform.OS == 'android');
var native;
if (IsAndroid) {
    native = NativeModules.ConferenceCreatorActivity;
} else {
    native = NativeModules.ConferenceCreatorViewController;
}

class ConferenceCreator extends Component {
    constructor(props) {
        super(props);

        console.log("uid:", this.props.uid);
        var rowHasChanged = function (r1, r2) {
            return r1 !== r2;
        }
        var ds = new ListView.DataSource({rowHasChanged: rowHasChanged});
        var data = this.props.users.slice();

        for (var i = 0; i < data.length; i++) {
            data[i].id = i;
            data[i].selected = this.props.uid == data[i].uid;
        }
        this.state = {
            data:data,
            dataSource: ds.cloneWithRows(data),
            visible:false,
        };
    }


    createConference(userIDs) {
        
        var url = this.props.url + "/conferences";

        this.showSpinner();
        fetch(url, {
            method:"POST",  
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                "Authorization": "Bearer " + this.props.token,
            },
            body:JSON.stringify(userIDs),
        }).then((response) => {
            console.log("status:", response.status);
            return response.json().then((responseJson)=>{
                this.hideSpinner();
                if (response.status == 200) {
                    console.log("response json:", responseJson);
                    native.onCreate(responseJson.id, userIDs);
                } else {
                    console.log("response error:", responseJson);
                    Toast.showLongBottom.bind(null, responseJson.meta.message);
                }
            });
        }).catch((error) => {
            console.log("error:", error);
            this.hideSpinner();
            Toast.showLongBottom.bind(null, '' + error);
        });
    }
    
    handleCreate() {
        var userIDs = [];
        var data = this.state.data;
        for (var i = 0; i < data.length; i++) {
            let u = data[i];
            if (u.selected) {
                userIDs.push(u.uid);
            }
        }
        if (userIDs.indexOf(this.props.uid) == -1) {
            userIDs.push(this.props.uid);
        }
        if (userIDs.length <= 1) {
            return;
        }
        this.createConference(userIDs);
    }

    handleCancel() {
        native.onCancel();
    }

    showSpinner() {
        this.setState({visible:true});
    }

    hideSpinner() {
        this.setState({visible:false});
    }

    render() {
        var renderRow = (rowData) => {
            var selectImage = () => {
                if (rowData.uid == this.props.uid) {
                    return  require('../../../../img/CellGraySelected.png');
                } else if (rowData.selected) {
                    return  require('../../../../img/CellBlueSelected.png');
                } else {
                    return require('../../../..//img/CellNotSelected.png');
                }
            }

            return (
                <TouchableHighlight style={styles.row} onPress={() => this.rowPressed(rowData)}
                                    underlayColor='#eeeeee' >
                    <View style={{flexDirection:"row", flex:1, alignItems:"center" }}>
                        <Image style={{marginLeft:10}} source={selectImage()}></Image>
                        <Text style={{marginLeft:10}}>{rowData.name}</Text>
                    </View>
                </TouchableHighlight>
            );
        }

        var leftButtonConfig = {
            title: '取消',
            handler: this.handleCancel.bind(this),
        };

        var rightButtonConfig = {
            title: '开始',
            handler: this.handleCreate.bind(this),
        };
        var titleConfig = {
            title: '添加成员',
        };

        return (
            <View style={{ flex:1, backgroundColor:"#F5FCFF" }}>
                <NavigationBar
                    statusBar={{hidden:false}}
                    style={{}}
                    title={titleConfig}
                    leftButton={leftButtonConfig} 
                    rightButton={rightButtonConfig} />

                <View style={{height:1, backgroundColor:"lightgrey"}}></View>

                <ListView
                    dataSource={this.state.dataSource}
                    renderRow={renderRow}
                />

                <Spinner visible={this.state.visible} />
            </View>
        );
    }

    rowPressed(rowData) {
        if (rowData.uid == this.props.uid) {
            return;
        }
        
        var data = this.state.data;
        var ds = this.state.dataSource;
        var newData = data.slice();
        var newRow = {uid:rowData.uid, name:rowData.name, id:rowData.id, selected:!rowData.selected};
        newData[rowData.id] = newRow;
        this.setState({data:newData, dataSource:ds.cloneWithRows(newData)});
    }

}


const styles = StyleSheet.create({
    row: {
        height:50,
    },
});

export default ConferenceCreator;
