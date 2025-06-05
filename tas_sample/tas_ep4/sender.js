// tas_sample/tas_ep4/sender.js

const { Client } = require('@elastic/elasticsearch');
const address_info = require('./address_info');

const elasticUrl = `http://${address_info.elasticsearch.ip}:${address_info.elasticsearch.port}`;
console.log('🔗 Connecting to Elasticsearch at:', elasticUrl);

const client = new Client({
  node: elasticUrl
});

async function send_elasticsearch(json_data) {
  try {
    const response = await client.index({
      index: 'sensor',         // 자동으로 고유 _id 생성
      body: json_data
    });

    console.log(`✅ Document indexed: result=${response.result}, _id=${response._id}`);
  } catch (error) {
    console.error('❌ Error indexing document:', error.meta?.body || error);
  }
}

module.exports = {
  send_elasticsearch
};
