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
const fs = require('fs');
const path = require('path');

const cloudfront = new AWS.CloudFront({ apiVersion: '2017-03-25' });
const s3 = new AWS.S3();

const asc = (a, b) => a - b;
const parseInt10 = str => parseInt(str, 10);

const renderSlideContent = (markup, type) => (
  type === 'md' ?
    `<section data-markdown><script type="text/template">${markup}</script></section>` :
    `<section>${markup}</section>`
);

const wrapSlide = slide => `
<section>
${slide}
</section>
`;

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
  listAllFromBucket(event.Records[0].s3.bucket.name)
    .then(contents => retrieveAll(
      event.Records[0].s3.bucket.name,
      contents.map(obj => obj.Key).filter(key => /\d+\/\d+\.(html|md)/.test(key))
    ))
    .then((keyObjectMap) => {
      console.log(Array.from(keyObjectMap.keys()));
      const grouping = Array.from(keyObjectMap.keys())
        .map(key => key.match(/(\d+)\/(\d+)\.(html|md)/))
        .reduce((groups, capture) => groups.set(
          parseInt10(capture[1]),
          groups.get(parseInt10(capture[1])) instanceof Map ?
            groups.get(parseInt10(capture[1]))
              .set(parseInt10(capture[2]), { key: capture.input, type: capture[3] }) :
            new Map([[parseInt10(capture[2]), { key: capture.input, type: capture[3] }]])
        ), new Map());
      return Array.from(grouping.keys()).sort(asc)
        .map((groupIndex) => {
          const subGroup = grouping.get(groupIndex);
          console.log(keyObjectMap.get(subGroup.values().next().value.key).Body.toString());
          return subGroup.size === 1 ?
            renderSlideContent(
              keyObjectMap.get(subGroup.values().next().value.key).Body.toString(),
              subGroup.values().next().value.type
            ) :
            wrapSlide(
              Array.from(subGroup.keys()).sort(asc)
                .map(index => renderSlideContent(
                  keyObjectMap.get(subGroup.get(index).key).Body.toString(),
                  subGroup.get(index).type
                )).join('\n')
            );
        }).join('\n');
    }).then(
      slides => new Promise(
        (resolve, reject) => fs.readFile(
          path.join(__dirname, 'template', 'index.html'),
          (err, data) => {
            if (err) {
              return reject(err);
            }
            s3.putObject({
              ACL: 'public-read',
              Bucket: process.env.PRESENTATION_BUCKET,
              Key: 'index.html',
              Body: data.toString().replace('%slides%', slides),
              ContentType: 'text/html',
            }).promise().then(resolve, reject);
          }
        )
      )
    )
    .then(() => cloudfront.createInvalidation({
      DistributionId: process.env.CLOUDFRONT_DISTRIBUTION,
      InvalidationBatch: {
        CallerReference: event.Records[0].responseElements['x-amz-request-id'],
        Paths: {
          Quantity: 2,
          Items: ['/index.html', '/search*'],
        },
      },
    }).promise())
    .then(() => callback(), callback);
};
