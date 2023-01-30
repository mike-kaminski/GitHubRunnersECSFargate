FROM debian

# Declare build arguments
ARG BUILD_DATE=""

# Declare environment variables
ENV AGENT_TOOLSDIRECTORY=/opt/actions-tools
ENV DEBIAN_FRONTEND=noninteractive
ENV GITHUB_ACCESS_TOKEN=""
ENV RUNNER_ALLOW_RUNASROOT=true
ENV RUNNER_LABELS=""
ENV RUNNER_NAME=""
ENV RUNNER_ORGANIZATION_URL="https://github.com/ORGANIZATION"
ENV RUNNER_TOKEN=""
ENV RUNNER_WORK_DIRECTORY="_work"
ENV USER_HOME="/root"

# Labels
LABEL org.label-schema.build-date=$BUILD_DATE \
    org.label-schema.name="github-runner" \
    org.label-schema.description="GitHub Actions runner."

# Install base packages
RUN DEBIAN_FRONTEND=noninteractive apt-get update && \
    apt-get install -y \
        apt-transport-https \
        build-essential \
        ca-certificates \
        curl \
        gcc \
        gettext \
        git \
        iputils-ping \
        jq \
        libcurl4-openssl-dev \
        liblttng-ust0 \
        openssh-client \
        postgresql-client \
        software-properties-common \
        sudo \
        supervisor \
        unzip \
        zlib1g-dev \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && sudo apt update \
    && sudo apt install gh -y

# Manage service with SupervisorD to permit agent restarts on updates.
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN chmod 644 /etc/supervisor/conf.d/supervisord.conf

# Install the GH runner agent
RUN mkdir -p /opt/actions-runner ${AGENT_TOOLSDIRECTORY}
WORKDIR /opt/actions-runner
RUN GH_RUNNER_VERSION=${GH_RUNNER_VERSION:-$(curl --silent "https://api.github.com/repos/actions/runner/releases/latest" | grep tag_name | sed -E 's/.*"v([^"]+)".*/\1/')} \
    && curl -L -O https://github.com/actions/runner/releases/download/v${GH_RUNNER_VERSION}/actions-runner-linux-x64-${GH_RUNNER_VERSION}.tar.gz \
    && tar -zxf actions-runner-linux-x64-${GH_RUNNER_VERSION}.tar.gz \
    && rm -f actions-runner-linux-x64-${GH_RUNNER_VERSION}.tar.gz \
    && ./bin/installdependencies.sh \
    && chown -R root: /opt/actions-runner \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set startup configuration
# Permit mounting of workdir for data persistence on EFS
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
VOLUME ["/opt/actions-runner/_work"]
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
