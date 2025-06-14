/**
 * Created by Il Yeup, Ahn in KETI on 2017-02-23.
 */

/**
 * Copyright (c) 2018, OCEAN
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * 3. The name of the author may not be used to endorse or promote products derived from this software without specific prior written permission.
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// 1. 모듈 및 기본 설정
var ip = require("ip"); // ip 모듈을 사용하여 IP 주소를 다룰 수 있도록 설정

var conf = {}; //conf 객체 설정 -> 각 객체 초기화
var cse = {};
var ae = {};
var cnt_arr = [];
var sub_arr = [];
var acp = {};

// 2. 프로토콜 설정
conf.useprotocol = 'http'; // 'http', 'mqtt', 'coap', 'ws' 중 선택 가능

//3. CSE설정
// build cse
cse.host        = 'localhost';
cse.port        = '7579';
cse.name        = 'Mobius';
cse.id          = '/Mobius2';
cse.mqttport    = '1883';
cse.wsport      = '7577';

// build ae
ae.name         = 'sharkFamily';

ae.id           = 'S' + ae.name;

ae.parent       = '/' + cse.name;
ae.appid        = 'smart_fish_farm';
ae.port         = '9727';
ae.bodytype     = 'json'; // select 'json' or 'xml' or 'cbor'
ae.tasport      = '3105';

// build cnt
var count = 0;
cnt_arr[count] = {};
cnt_arr[count].parent = '/' + cse.name + '/' + ae.name;
cnt_arr[count++].name = 'temp';
cnt_arr[count] = {};
cnt_arr[count].parent = '/' + cse.name + '/' + ae.name;
cnt_arr[count++].name = 'ph';
cnt_arr[count] = {};
cnt_arr[count].parent = '/' + cse.name + '/' + ae.name;
cnt_arr[count++].name = 'turbi';
cnt_arr[count] = {};
cnt_arr[count].parent = '/' + cse.name + '/' + ae.name;
cnt_arr[count++].name = 'do';
cnt_arr[count] = {};
cnt_arr[count].parent = '/' + cse.name + '/' + ae.name;
cnt_arr[count++].name = 'nh4';
cnt_arr[count] = {};
cnt_arr[count].parent = '/' + cse.name + '/' + ae.name;
cnt_arr[count++].name = 'salt';
//cnt_arr[count] = {};
//cnt_arr[count].parent = '/' + cse.name + '/' + ae.name;
//cnt_arr[count++].name = 'led';
//cnt_arr[count] = {};
//cnt_arr[count].parent = '/' + cse.name + '/' + ae.name;
//cnt_arr[count++].name = 'temp';
//cnt_arr[count] = {};
//cnt_arr[count].parent = '/' + cse.name + '/' + ae.name;
//cnt_arr[count++].name = 'tvoc';
// cnt_arr[count] = {};
// cnt_arr[count].parent = '/' + cse.name + '/' + ae.name;
// cnt_arr[count++].name = 'timer';

// build sub
count = 0;
//sub_arr[count] = {};
//sub_arr[count].parent = '/' + cse.name + '/' + ae.name + '/' + cnt_arr[1].name;
//sub_arr[count].name = 'sub-ctrl';
//sub_arr[count++].nu = 'mqtt://' + cse.host + '/' + ae.id;

// --------
sub_arr[count] = {};
sub_arr[count].parent = '/' + cse.name + '/' + ae.name + '/' + cnt_arr[1].name;
sub_arr[count].name = 'sub';
sub_arr[count++].nu = 'mqtt://' + cse.host + '/' + ae.id + '?ct=' + ae.bodytype; // mqtt
//sub_arr[count++].nu = 'http://' + ip.address() + ':' + ae.port + '/noti?ct=json'; // http
//sub_arr[count++].nu = 'Mobius/'+ae.name; // mqtt
// --------

/*// --------
sub_arr[count] = {};
sub_arr[count].parent = '/' + cse.name + '/' + ae.name + '/' + cnt_arr[1].name;
sub_arr[count].name = 'sub2';
//sub_arr[count++].nu = 'http://' + ip.address() + ':' + ae.port + '/noti?ct=json'; // http
//sub_arr[count++].nu = 'mqtt://' + cse.host + '/' + ae.id + '?rcn=9&ct=' + ae.bodytype; // mqtt
sub_arr[count++].nu = 'mqtt://' + cse.host + '/' + ae.id + '?ct=json'; // mqtt
// -------- */

// build acp: not complete
acp.parent = '/' + cse.name + '/' + ae.name;
acp.name = 'acp-' + ae.name;
acp.id = ae.id;


conf.usesecure  = 'disable';

if(conf.usesecure === 'enable') {
    cse.mqttport = '8883';
}

conf.cse = cse;
conf.ae = ae;
conf.cnt = cnt_arr;
conf.sub = sub_arr;
conf.acp = acp;


module.exports = conf;
