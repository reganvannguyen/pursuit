# Source layout

Expo Router screens live in `app/`, and reusable presentation components live in `components/`.

| Directory | Responsibility |
| --- | --- |
| `engine/` | Pure TypeScript gameplay rules. Keep Expo, React Native, device APIs, and persistence out of this layer. |
| `services/location/` | Location tracking and measurement adapters. |
| `services/audio/` | Audio playback and interruption handling. |
| `services/speech/` | Short voice-command recognition adapters. |
| `database/` | Local persistence, schema, migrations, and repositories. |
| `content/` | Bundled episode definitions and content schemas. |

Bundled audio and other app files belong under the repository-level `assets/` directory; audio files go in `assets/audio/`.
