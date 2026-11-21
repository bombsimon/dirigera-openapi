// Redoc doesn't render vendor extensions on operations, so surface them in the description.
// https://redocly.com/docs/cli/custom-plugins/custom-decorators
function describeVerification(isVerified) {
  if (isVerified) {
    return '✅ <strong>Verified</strong> against a real hub';
  }

  return '⚠️ <strong>Unverified</strong>, described from community sources only';
}

function describeSources(sourceSlugs, sourceRepositories) {
  const sourceRows = sourceSlugs.map((slug) => {
    const repositoryUrl = sourceRepositories[slug];
    const sourceLink = repositoryUrl ? `[${slug}](${repositoryUrl})` : `\`${slug}\``;

    return `| ${sourceLink} |`;
  });

  return ['| Sources |', '| --- |', ...sourceRows].join('\n');
}

// A collapsed <details> keeps the status on one line with sources a click away.
function describeOperationMetadata(operation, sourceRepositories) {
  const summary = describeVerification(operation['x-verified'] === true);
  const sourceSlugs = Array.isArray(operation['x-sources']) ? operation['x-sources'] : [];

  if (sourceSlugs.length === 0) {
    return summary;
  }

  const sourcesTable = describeSources(sourceSlugs, sourceRepositories);

  return `<details>\n<summary>${summary}</summary>\n\n${sourcesTable}\n\n</details>`;
}

function prependToInfoDescription(markdown) {
  return {
    leave(info) {
      info.description = info.description ? `${markdown}\n\n${info.description}` : markdown;
    },
  };
}

function restApiLinkDecorator() {
  return {
    Info: prependToInfoDescription(
      '> 🔌 **REST API** (devices, rooms, scenes, pairing and more) is documented on the [REST API page](../).'
    ),
  };
}

function operationMetadataDecorator() {
  let sourceRepositories = {};

  return {
    Root: {
      enter(root) {
        sourceRepositories = root['x-source-repositories'] ?? {};
      },
    },
    // The websocket is rendered as a separate page from the AsyncAPI spec.
    Info: prependToInfoDescription(
      '> 📡 **Websocket events** (ping, pong and change events) are documented on the [events page](events/).'
    ),
    Operation: {
      leave(operation) {
        const metadata = describeOperationMetadata(operation, sourceRepositories);
        operation.description = operation.description
          ? `${metadata}\n\n${operation.description}`
          : metadata;
      },
    },
  };
}

module.exports = function operationMetadataPlugin() {
  return {
    id: 'dirigera',
    decorators: {
      oas3: {
        'operation-metadata': operationMetadataDecorator,
      },
      async3: {
        'rest-api-link': restApiLinkDecorator,
      },
    },
  };
};
