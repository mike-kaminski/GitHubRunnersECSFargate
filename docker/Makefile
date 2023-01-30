CONTAINER_REPO?="763216446258.dkr.ecr.us-east-1.amazonaws.com/github-runner"
BUILD_DATE?=""
GITHUB_ACCESS_TOKEN?=""
VCS_REF?=""
VERSION?=v0.0.1-alpha
OS := $(shell uname -s)
# HELP
# This will output the help for each task
.PHONY: help
help: ## This help.
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help

build: ## Build the image
ifeq ($(OS),Darwin)
	docker buildx build --platform linux/amd64 --build-arg BUILD_DATE=$(BUILD_DATE) --build-arg VCS_REF=$(VCS_REF) -t $(CONTAINER_REPO):$(VERSION) .
endif
ifeq ($(OS),Linux)
	docker build --build-arg BUILD_DATE=$(BUILD_DATE) --build-arg VCS_REF=$(VCS_REF) -t $(CONTAINER_REPO):$(VERSION) .
endif

shell: ## Creates a shell inside the container for debug purposes
	docker run -it $(CONTAINER_REPO):$(VERSION) bash

test: ## Test startup functionality
## -e RUNNER_REPOSITORY_URL=https://github.com/ProjectAussie/github-runner
	docker run -it \
	    -e RUNNER_ORGANIZATION_URL=https://github.com/ProjectAussie \
		-e RUNNER_LABELS=x64,linux,devops \
		-e GITHUB_ACCESS_TOKEN=$(GITHUB_ACCESS_TOKEN) \
		$(CONTAINER_REPO):$(VERSION)

push: ## pushes image to private repository
	docker push $(CONTAINER_REPO):$(VERSION)
