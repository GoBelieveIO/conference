#!/bin/sh
BASEDIR=$(dirname $0)
keytool -genkey -v -keystore $BASEDIR/app/gradle.keystore -alias gradle -keyalg RSA -keysize 2048 -validity 10000
