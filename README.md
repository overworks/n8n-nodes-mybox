# @overworks/n8n-nodes-mybox

**English** | [한국어](README.ko.md)

An n8n community node for the NAVER MYBOX Open API, implementing all 20 documented API endpoints and file transfers using n8n binary data.

This package is in development and has not been published to npm. The plan is to complete testing with a real account, make the GitHub repository public, and publish the package to npm. Submission for n8n community node verification will follow the first release.

## Features

- **NAVER MYBOX API Credential**: personal access token (PAT) authentication and connection testing.
- **Storage → Get**: retrieve total and used storage, file counts by type, the maximum upload file size, and the trash retention period.
- **File or Folder → Get / Get Many**: retrieve metadata and list resources in the root or a specific folder.
- **File / Folder → Search**: search by query, type, date, or folder path.
- **File → Upload / Download**: upload n8n binary data and download files as streams.
- **File → Get Upload URL / Get Download URL**: request transfer URLs, including upload URLs and offsets for resumable uploads.
- **Folder → Create**: create a folder in the root or under a specific parent folder.
- **File or Folder → Copy / Move / Rename / Move to Trash / Favorite / Unfavorite**: manage files and folders.
- **Trash → Get Many / Restore / Permanently Delete / Empty**: list and restore trashed resources, permanently delete individual resources, or empty the trash.
- **Storage → Update**: set the trash retention period to Off, 5, 15, 30, or 50 days.
- Cursor pagination with **Return All** and **Limit** for listings and searches.
- Per-item execution, output item linking, and support for n8n's continue-on-fail setting.
- Up to two retries for HTTP 429 responses from read APIs, respecting `Retry-After` and waiting 60 seconds when the header is absent. A requested delay longer than 60 seconds results in an error.

All 20 documented endpoints are implemented. Integration testing with a real account is still required.

Upload reads the input file into memory and builds a multipart request, so consider the memory available to n8n when working with large files. Resumable upload support is limited to requesting a URL and offset through **Get Upload URL**; interrupted transfers are not resumed automatically. The upload server's response is returned in `uploadResponse`.

Mutating operations and file transfers are not retried automatically. The PAT is not added to upload or download URL requests, and file transfer error messages do not expose authentication information from those URLs.

## Authentication

1. In the MYBOX web interface, open **Settings → Account and Personal Access Token Management** and create a token.
2. Create a **NAVER MYBOX API** credential in n8n.
3. Enter the raw token in **Personal Access Token**. The node adds the `Bearer` prefix.
4. Save the credential and run the connection test, which calls `GET /v1/drive/storage`.

The token is shown only once when it is created. Store it in the n8n credential and replace it before it expires.

See [Getting started with the MYBOX Open API](https://developers.mybox.naver.com/getting-started) for token creation instructions and restrictions.

## Usage notes

- Use the `resourceId` returned by a listing or search as the file or folder ID.
- Leave **Folder ID** empty when listing the root. Leave **Parent Folder ID** empty when creating a folder, uploading, or copying to the root. **Move requires a destination folder ID.**
- Include the extension in file names. If **File Name** is empty during an upload, the input binary file name is used. **Input Data Field Name** defaults to `data`.
- Download passes the stream to n8n's binary helper. **Put Output File in Field** defaults to `data`, and other input binary fields are preserved.
- Searches require at least one query, date filter, or file type. Folders can be searched using **Exact Path** alone; when provided, it overrides the other search conditions.
- **Overwrite** is disabled by default for copy, move, upload, and restore operations.
- **Move to Trash** allows later restoration. **Permanently Delete** and **Empty** under Trash are permanent; **Empty** applies to the account's entire trash.
- Upload URLs are valid for 48 hours and cannot be reused after an upload. Download URLs are single-use and valid for 10 minutes. URL request operations include these authenticated URLs in their output. See the [upload API](https://developers.mybox.naver.com/docs/files_upload) and [download API](https://developers.mybox.naver.com/docs/files_download).

## Contributing

See the [contribution guidelines](CONTRIBUTING.md) for the repository layout, development setup, build and test commands, lint checks, and implementation conventions.

## Testing with an existing Docker n8n instance

You can install the `.tgz` archive in an existing self-hosted n8n instance before publishing to npm. To build the archive, follow the [development and validation guide](CONTRIBUTING.md#development-and-validation).

The following example assumes the official image, a Compose service named `n8n`, and a persistent data directory at `/home/node/.n8n`. Copy the archive to the server's Compose project directory, then run:

```sh
docker compose exec -u node n8n mkdir -p /home/node/.n8n/nodes

docker compose cp overworks-n8n-nodes-mybox-0.1.0.tgz \
  n8n:/home/node/.n8n/nodes/

docker compose exec -u node -w /home/node/.n8n/nodes n8n \
  npm install --omit=dev --ignore-scripts ./overworks-n8n-nodes-mybox-0.1.0.tgz

docker compose restart n8n
```

Adjust the commands for your service name and data directory. Persisting `/home/node/.n8n` in a volume keeps the package installed when the container is recreated. In queue mode, the same package must also be available to the workers that execute workflows. See [manual installation in n8n](https://docs.n8n.io/integrations/community-nodes/installation/manual-install/).

1. Import the [storage check example](examples/storage-check.json) into n8n.
2. Attach your PAT credential to the NAVER MYBOX node.
3. Run the workflow manually and inspect outputs such as `quotaBytes`, `usedBytes`, and `fileCounts`.
4. Check listing and search operations, then use a dedicated test folder to test small-file uploads and downloads, copying, moving, renaming, moving to trash, and restoring.

Integration testing with a real PAT, service responses, and file transfers has not yet been completed.

## Release plan

1. Implement features and automated tests in a private repository.
2. Run integration tests with an existing self-hosted n8n instance and a real MYBOX account.
3. Make the GitHub repository public.
4. Publish `@overworks/n8n-nodes-mybox` as a public npm package.
5. Apply for n8n community node verification.

The package has `publishConfig.access` set to `public`. An automated release workflow has not been configured yet.

## References

- [MYBOX Open API](https://developers.mybox.naver.com/)
- [Storage API](https://developers.mybox.naver.com/docs/dms_storage)
- [Creating n8n nodes](https://docs.n8n.io/integrations/creating-nodes/overview/)

## License

[MIT](LICENSE)
