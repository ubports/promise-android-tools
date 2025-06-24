# Changelog

This changelog is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

promise-android-tools versioning started at 1.0.0, but this changelog was not added until 4.0.6.

## [Unreleased]

## [6.0.0] - 2025-06-25

### Added

- Support Node v20 and above
- Merge `android-tools-bin` into `promise-android-tools`
- Support running within electron

### Changed

- `fastboot getvar` is more robust now

### Fixed

- `adb sideload` is not cancelling when finishing anymore
  - This was caused by `adb: failed to read command: Success` being sent via stderr
- `fastboot --set-active` is working again
  - This got broken with 5.0.0

## [5.0.1] - 2025-06-10

### Added

- Enforce Node v18 in package.json
- Use `tsup` to generate cjs and esm code

## [5.0.0] - 2025-06-10

### Changed

- Bump to Node v18
- Major refactoring and Typescript migration, see the [README.md](./README.md) upgrade guide ([#73](https://github.com/ubports/promise-android-tools/pull/73))
- Dependency updates
- Removal of unused code

### Added

- adb.connect() function to connect to network devices ([#65](https://github.com/ubports/promise-android-tools/pull/65))
- Introduce a setPath option for tools ([#72](https://github.com/ubports/promise-android-tools/pull/72))
- documentation served on [ubports.github.io/promise-android-tools](https://ubports.github.io/promise-android-tools) [#75](https://github.com/ubports/promise-android-tools/issues/75) [#80](https://github.com/ubports/promise-android-tools/pull/80)

## [4.0.13] - 2022-09-07

### Changed

- Bump version to fix broken packaging

## [4.0.12] - 2022-09-07

### Added

- adb: allow rebooting to download mode ([7a1846b3c2e799b675b1e63cb5066f16fd1804f6](https://github.com/ubports/promise-android-tools/commit/7a1846b3c2e799b675b1e63cb5066f16fd1804f6))
- adb: allow rebooting to edl mode ([323bb7dc36880d35473062616fc08fd511bf4db9](https://github.com/ubports/promise-android-tools/commit/323bb7dc36880d35473062616fc08fd511bf4db9))

### Changed

- Update dependencies ([63cbfb09f21987de0f22e58ef6f77c965d232e58](https://github.com/ubports/promise-android-tools/commit/63cbfb09f21987de0f22e58ef6f77c965d232e58))

### Fixed

- Fix CRLF handling in fastboot getvar ([53f16e9322d399a69efdd02f2ff8fa575a9e71e3](https://github.com/ubports/promise-android-tools/commit/53f16e9322d399a69efdd02f2ff8fa575a9e71e3))

## [4.0.11] - 2022-07-26

### Added

- Fastboot: add commands for interacting with logical partitions ([bd2d690c522705100a5f5535360c0b6ac4d661f7](https://github.com/ubports/promise-android-tools/commit/bd2d690c522705100a5f5535360c0b6ac4d661f7))

## [4.0.10] - 2022-03-24

### Fixed

- Handle protocol fault / connection reset error in adb ([#63](https://github.com/ubports/promise-android-tools/pull/63))

### Changed

- Update dependencies ([145a0e28bc61ea1cc359b4e3d82d911db3fc83dc](https://github.com/ubports/promise-android-tools/commit/145a0e28bc61ea1cc359b4e3d82d911db3fc83dc))

## [4.0.9] - 2022-03-20

### New

- Adb: add getprop() and getSystemImageCapability() ([#61](https://github.com/ubports/promise-android-tools/pull/61))

### Changed

- Update dependencies ([6d47250c40bdf9dc1a24d748e72b13f8d50ae36d](https://github.com/ubports/promise-android-tools/commit/6d47250c40bdf9dc1a24d748e72b13f8d50ae36d))

## [4.0.8] - 2022-03-10

### New

- Fastboot: add command to wipe super ([#58](https://github.com/ubports/promise-android-tools/pull/58))
- Fastboot: add reboot commands for fastbootd and recovery mode ([#57](https://github.com/ubports/promise-android-tools/pull/57))

## [4.0.7] - 2021-10-02

### Changed

- Update dependencies ([fae268b54af6ab941a2129e670a6e582b0e48815](https://github.com/ubports/promise-android-tools/commit/fae268b54af6ab941a2129e670a6e582b0e48815))

## [4.0.6] - 2021-04-16

### Fixed

- Prevent downstream race conditions in `adb.startServer()` ([#56](https://github.com/ubports/promise-android-tools/pull/56))
