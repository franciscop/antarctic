# Contributor manual

## Repository

`master` contains the source code of the latest published version of the library and its docs.

## Contributing to the docs

We welcome all contributions to the docs. Antarctic uses [documentation.page](https://documentation.page), which builds the site straight from the repository. All pages are markdown files in the `documentation` directory, and `documentation.page.json` maps them to the pages of the site.

Each page's sidebar is built from its `##` headings. The provider and reference pages are folders whose files are concatenated in filename order, so a provider is an `##` heading and its sections are `###`.

PRs for changes to the docs should be made against the `master` branch.

## Contributing to the source code

We are open to most contributions, but please open a new issue before creating a pull request, especially for new features. It's likely your PR will be rejected if not. We have intentionally limited the scope of the project and we would like to keep the package lean.

PRs for changes to the library source code should be made against the `master` branch.

Provider fixes that are not specific to Antarctic's high level layer are usually better sent to [Arctic](https://github.com/pilcrowonpaper/arctic), where they benefit everyone. Antarctic tracks it.

### Set up

```
npm install
```

### Testing

Run `npm test` to run the tests and `npm run build` to build the package.

```
npm test

npm run build
```
