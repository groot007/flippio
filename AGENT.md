# AGENT.md

## Expo Dev Build Debugging

- When the iOS Expo dev build shows a blank screen or appears stuck before useful Metro/dev logs, run:

```bash
cd /Users/mykolastanislavchuk/Home/Flippio/example_app
npx expo start --no-dev --minify
```

- This can surface the underlying JavaScript runtime error more clearly than the normal dev-client flow.
