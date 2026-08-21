## OAuth2Tokens

Represents a JSON-parsed successful token response body.

### Constructor

```ts
function constructor(data: object): this;
```

#### Parameters

- `data`: JSON-parsed successful response body.

### Methods

- [`accessToken()`](/documentation/reference#oauth2tokensaccesstoken)
- [`accessTokenExpiresAt()`](/documentation/reference#oauth2tokensaccesstokenexpiresat)
- [`accessTokenExpiresInSeconds()`](/documentation/reference#oauth2tokensaccesstokenexpiresinseconds)
- [`hasRefreshToken()`](/documentation/reference#oauth2tokenshasrefreshtoken)
- [`refreshToken()`](/documentation/reference#oauth2tokensrefreshtoken)

### Properties

```ts
interface Properties {
	data: object;
}
```

- `data`: `JSON.parse()`-ed response body.
