// usage :
//// modify address_info.js to set the end point
//const sender = require('./sender');
//function send_to_elasticsearch() {
//  const json_data = { // JSON data to be sent
//    "applicationID": 1001,
//    "applicationName": "TestApp",
//    "devEUI": 1234567890123456,
//    "deviceName": "Device1",
//    "Temp": ep4.temp,
//    "pH": ep4.ph,
//    "TURBIDITY": ep4.turbi,
//    "DO": ep4.do,
//    "NH4": ep4.nh4,
//    "salt": ep4.salt,
//    "ALCOHOL": 0.0,
//    "createdAt": new Date(),
//    "updatedAt": new Date()
//  };
//  sender.send_elasticsearch(json_data);
//}
//wdt.set_wdt(require('shortid').generate(), 60 * 30, send_to_elasticsearch);
const { Client } = require('@elastic/elasticsearch');

const address_info = require('./address_info');

// Replace with your Elasticsearch server details
const client = new Client({ node: `http://${address_info.elasticsearch.ip}:${address_info.elasticsearch.port}` });

let id = 0;

async function send_elasticsearch(json_data) {
  try {
    // Replace with your desired index, type, and JSON data
    const response = await client.index({
      index: 'sensor',          // Elasticsearch index name
      id: id.toString(),                   // Optional: Document ID
      body: json_data,
    });

    ++id;

    console.log('Document indexed:', response);
  } catch (error) {
    console.error('Error indexing document:', error);
  }
}

let sender = {
  send_elasticsearch : send_elasticsearch
};

module.exports = sender;
