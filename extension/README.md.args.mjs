export const extraContents = `## 🚀 Miniapp Functionality

Miniapp extension adds functionality to easily create a Farcaster/Base MiniApp. It will take care of manifest file generation at .well-known/farcatser.json as well as generation of the metatags required for miniapp rendering in Farcaster/Base feed.

### Requirements

According to [MiniApp SDK documentation](https://miniapps.farcaster.xyz/docs/getting-started):

- Node.js 22.11.0 or higher (LTS version recommended)
- Check your version: \`\`\`node --version\`\`\`
- Download from [nodejs.org](https://nodejs.org)

### Installation
- Copy packages/nextjs/.env.example to packages/nextjs/.env
- Run ngrok (or other) externally available tunnel
\`\`\`typescript
ngrok http http://localhost:3000 --url https://yoursubdomian.ngrok.dev
\`\`\`
- Update \`\`\`NEXT_PUBLIC_URL\`\`\` in packages/nextjs/.env for your domain
- Go to https://farcaster.xyz/~/developers/mini-apps/preview , enter your app domain and click "Open URL as Mini App"

Your miniapp should render as a MiniApp in Farcaster Preview

![MiniApp Preview](https://raw.githubusercontent.com/NikolaiL/miniapp/master/images/MiniAppScreenshot.png)

For production you will need to generate the manifest accountAssociation values for your production domain and add them to the .env file (\`\`\`FARCASTER_HEADER, FARCASTER_PAYLOAD, FARCASTER_SIGNATURE\`\`\`). You can generate them using [Farcaster Manifest Tools](https://farcaster.xyz/~/developers/mini-apps/manifest).

### 🔗 Links

- [Farcaster MiniApp Documentation](https://miniapps.farcaster.xyz)
- [Farcaster MiniApp DevTools](https://farcaster.xyz/~/developers/)
- [Base Miniapp Preview](https://www.base.dev/preview)
`;