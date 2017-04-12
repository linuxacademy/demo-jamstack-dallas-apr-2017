/*
  Copyright 2017 Linux Academy

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

const AWS = require('aws-sdk');
const Fuse = require('fuse.js');

const cloudformation = new AWS.CloudFormation();
const s3 = new AWS.S3();

const getBucketName = stack => cloudformation.describeStacks({
  StackName: stack
}).promise().then(data => {
  const output = data.Stacks[0].Outputs.find(o => o.OutputKey === 'SourceBucket')
  return output ?
    output.OutputValue :
    Promise.reject('No source bucket output found')
});

const listAllFromBucket = (bucket, continuationToken) => s3.listObjectsV2({
  Bucket: bucket,
  ContinuationToken: continuationToken,
}).promise().then(data => (
  data.IsTruncated ?
    listAllFromBucket(bucket, data.NextContinuationToken)
      .then(continuation => data.Contents.concat(continuation)) :
    data.Contents
));

const retrieveAll = (bucket, keys) => {
  const keyObjectMap = new Map();

  return Promise.all(
    keys.map(
      key => s3.getObject({
        Bucket: bucket,
        Key: key,
      }).promise()
        .then(obj => keyObjectMap.set(key, obj))
    )
  ).then(() => keyObjectMap);
};

exports.handler = (event, context, callback) => {
  const query = event.queryStringParameters.q;
  if (!query) {
    return callback(null, { statusCode: 400 });
  }

  getBucketName(process.env.CLOUDFORMATION_STACK)
    .then(bucket => listAllFromBucket(bucket)
      .then(contents => retrieveAll(
        bucket,
        contents.map(obj => obj.Key).filter(key => /\d+\/\d+\.md/.test(key))
      ))
    ).then((keyObjectMap) => (new Fuse(
      Array.from(keyObjectMap)
        .map(([key, result]) => ({
          key: key.replace(/(.+).md/, '$1'),
          text: result.Body.toString()
        })),
      {
        shouldSort: true,
        tokenize: true,
        threshold: 0.6,
        location: 0,
        distance: 1000,
        maxPatternLength: 64,
        minMatchCharLength: 1,
        id: 'key',
        keys: ['text'],
      }
    )).search(query))
    .then(result => callback(null, {
      headers: { 'Content-Type': 'application/json' },
      statusCode: 200,
      body: JSON.stringify(result),
    })).catch(err => callback(err))
};
