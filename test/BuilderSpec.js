'use script';

var RTC = require("../lib/rtc")
var webrtc = require("../lib/index");

describe("The RTC builder", function() {
    
    it("builds RTC instances", function() {
        expect(webrtc.builder().build() instanceof RTC).toBeTruthy();
    });
});