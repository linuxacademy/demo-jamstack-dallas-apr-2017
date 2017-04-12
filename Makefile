#  Copyright 2017 Linux Academy
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

SHELL = /bin/bash
deploy: dependencies
deploy: CERT_ARN = $(shell shyaml get-value AWS.CloudFront.sslCertArn < config.yaml)
deploy: DISTRIBUTION_PRICE_CLASS = $(shell shyaml get-value AWS.CloudFront.priceClass < config.yaml)
deploy: PACKAGE_BUCKET = $(shell shyaml get-value AWS.S3.packageBucket < config.yaml)
deploy: PRESENTATION_BUCKET = $(shell shyaml get-value AWS.S3.presentationBucket < config.yaml)
deploy: SLIDE_BUCKET = $(shell shyaml get-value AWS.S3.slideBucket < config.yaml)
deploy: STACK_NAME = $(shell shyaml get-value AWS.CloudFormation.stackName < config.yaml)
deploy: SITE_URL = $(shell shyaml get-value Site.URL < config.yaml)
deploy:
	mkdir -p stack/build
	rsync -a --exclude '**/node_modules' stack/handlers stack/build/
	cd stack/build/handlers/generate; npm install --production
	cd stack/build/handlers/search; npm install --production
	aws cloudformation package --template-file stack/template.yaml --s3-bucket $(PACKAGE_BUCKET) --output-template-file sam-output.yaml
	aws cloudformation deploy --template-file sam-output.yaml --stack-name $(STACK_NAME) --capabilities CAPABILITY_IAM --parameter-overrides PresentationBucketName=$(PRESENTATION_BUCKET) SourceBucketName=$(SLIDE_BUCKET) SiteURL=$(SITE_URL) SSLCertARN=$(CERT_ARN) $(if $(DISTRIBUTION_PRICE_CLASS),DistributionPriceClass=$(DISTRIBUTION_PRICE_CLASS))

dependencies:
	if ! which aws; then \
		echo "Please install the AWS CLI. See https://aws.amazon.com/cli/"; \
		exit 1; \
	fi
	if ! which shyaml; then \
		pip install shyaml; \
	fi

update: SLIDE_BUCKET = $(shell shyaml get-value AWS.S3.slideBucket < config.yaml)
update:
	aws s3 sync --delete slides s3://$(SLIDE_BUCKET)

updatetemplate: PRESENTATION_BUCKET = $(shell shyaml get-value AWS.S3.presentationBucket < config.yaml)
updatetemplate:
	aws s3 sync --acl public-read --delete --exclude index.html stack/handlers/generate/template s3://$(PRESENTATION_BUCKET)
