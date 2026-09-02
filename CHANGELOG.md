# Changelog

## [1.3.1](https://github.com/roquerodrigo/subway-builder-auto-lines/compare/v1.3.0...v1.3.1) (2026-09-02)


### Documentation

* add GitHub Sponsors button and support section ([3ee47ce](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/3ee47ce13a38b6e1201e63c30e83d42c7cc75b87))


### Miscellaneous Chores

* **deps-dev:** bump the npm_and_yarn group across 1 directory with 2 updates ([3645329](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/364532931c93143eff68dfc3e28225ab9bfe752b))
* **deps-dev:** bump undici ([8ab818e](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/8ab818e794e95c8562d51794da6c1f5d838689fa))

## [1.3.0](https://github.com/roquerodrigo/subway-builder-auto-lines/compare/v1.2.0...v1.3.0) (2026-08-17)


### Features

* apply the settings city-wide, and give a line its own service ([d3e6905](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/d3e690553fab845f5fa9196cad86f013e9f8f567))
* configure service from the panel and grant rolling stock for free ([fb1e6b1](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/fb1e6b108ede18fa0e30c04ac4b5bc2d2e0fe863))
* keep the line list sorted by name ([bd8f326](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/bd8f326be56d286486b685d6e9d0927669f2ed2b))
* list only the lines that can be extended ([af4bf51](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/af4bf5132d6a6711c1a680660512a55276a9f078))
* run full ten-car trains on 5/15/30/60-minute headways ([bec3522](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/bec3522fffa548d07ed3378d2f248ba39397a951))


### Bug Fixes

* keep a built line through a save reload ([58fb4c2](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/58fb4c29ce2787e874f1c4f97757fff52d58960d))
* place the settings switch knob inside its track ([2294516](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/22945168a73d484028f577cbb74fd16d756a2c1a))


### Documentation

* update CLAUDE.md ([c23a2dc](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/c23a2dc7d6da14cea59e06a491d209dad4929304))


### Continuous Integration

* assign open issues and pull requests to the repository owner ([14ed644](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/14ed644b71bcaa24e8f12bf4e7df3730e882ceb9))
* call the shared auto-assign workflow instead of duplicating it ([8357e59](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/8357e59cc2ef0020ca854d103393bdc1ff660fe4))


### Miscellaneous Chores

* move CI to the shared workflows repository ([a32611a](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/a32611aa87f3467a177982694b48da5e8e19754a))
* release on every conventional commit type ([1f70fc3](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/1f70fc3aedc2941140330cb670f240cf5dd3d109))

## [1.2.0](https://github.com/roquerodrigo/subway-builder-auto-lines/compare/v1.1.0...v1.2.0) (2026-07-19)


### Features

* widen the subway-builder range to 1.4.0 and up ([7d0a7e1](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/7d0a7e1880277d13cff0d41184acf67188ad6c6b))

## [1.1.0](https://github.com/roquerodrigo/subway-builder-auto-lines/compare/v1.0.1...v1.1.0) (2026-07-19)


### Features

* widen the subway-builder range to any 1.4.x ([ce1b771](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/ce1b771812838d245f51bea29ab6ee82db094d63))

## [1.0.1](https://github.com/roquerodrigo/subway-builder-auto-lines/compare/v1.0.0...v1.0.1) (2026-07-18)


### Miscellaneous Chores

* support Subway Builder 1.4.12 ([e514b1b](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/e514b1b41a67c4b71e6e45a312b5c6ba6788544f))

## 1.0.0 (2026-07-16)


### Features

* automate building transit lines ([1204fef](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/1204fefa029931829d8d0855cbeb671a07691cc8))


### Bug Fixes

* call the lifecycle hooks on the API, and report a failure ([3871d0a](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/3871d0a01e0ed0a80a1345b3d7c96c072c7a6efb))
* clear an abandoned attempt's leftovers, not just its preview ([1116579](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/11165797150a54091169328a77ee4cc048d02e1d))
* count new stops by station, not by name ([1c32129](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/1c32129ba32808572608fb59541e76fd6fc9d029))
* don't claim a line was built when the game refused the commit ([c3ecd2c](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/c3ecd2c5cdf131f7fc4556c4eff46c8d82807415))
* don't hand the player free money when buying trains fails ([818ac82](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/818ac821a80e19a6fa3c2f499c78212f7f4a3eaf))
* pull the panel back on screen when it opens off it ([0c44a33](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/0c44a338793d8849005693a9b97fb0e552828540))
* retry the preview draw when the map style can't be read ([dd53554](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/dd5355427eb469c337c4272669f04e63450db0a7))
* stop the corridor walk from circling back to where it started ([d5265d8](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/d5265d81852551f5533e3a72318925c8ef71e283))
* unwind the preview when applying an extension fails ([9e071fe](https://github.com/roquerodrigo/subway-builder-auto-lines/commit/9e071feb3b41c9676c112a974a722f87ce740786))
