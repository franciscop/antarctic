## OAuth2Tokens

Represents a JSON-parsed successful token response body.

### Constructor

```ts
function constructor(data: object): this;
```

#### Parameters

- `data`: JSON-parsed successful response body.

### Methods

- [`accessToken()`](/reference#oauth2tokensaccesstoken)
- [`accessTokenExpiresAt()`](/reference#oauth2tokensaccesstokenexpiresat)
- [`accessTokenExpiresInSeconds()`](/reference#oauth2tokensaccesstokenexpiresinseconds)
- [`hasRefreshToken()`](/reference#oauth2tokenshasrefreshtoken)
- [`refreshToken()`](/reference#oauth2tokensrefreshtoken)

### Properties

```ts
interface Properties {
	data: object;
}
```

- `data`: `JSON.parse()`-ed response body.
