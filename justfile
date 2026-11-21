redocly_version := "2.82.0"
site_directory := "site"

default:
    @just --list

# Build the static documentation site for GitHub Pages
docs: clean
    mkdir -p {{ site_directory }}/events
    npx --yes @redocly/cli@{{ redocly_version }} build-docs openapi.yaml \
        --output {{ site_directory }}/index.html
    npx --yes @redocly/cli@{{ redocly_version }} build-docs asyncapi.yaml \
        --output {{ site_directory }}/events/index.html
    cp openapi.yaml asyncapi.yaml {{ site_directory }}/

# Serve the built site locally
serve: docs
    python3 -m http.server --directory {{ site_directory }} 8000

clean:
    rm -rf {{ site_directory }}
