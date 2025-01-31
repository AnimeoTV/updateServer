var platforms = require("../lib/utils/platforms")
var useragent = require("express-useragent")

describe("Platforms", function () {
  describe("Detect", function () {
    test("should detect osx_64", function () {
      expect(platforms.detect("myapp-v0.25.1-darwin-x64.zip")).toEqual(
        platforms.OSX_64,
      )
      expect(platforms.detect("myapp.dmg")).toEqual(platforms.OSX_64)
    })

    test("should detect windows_32", function () {
      expect(platforms.detect("myapp-v0.25.1-win32-ia32.zip")).toEqual(
        platforms.WINDOWS_32,
      )
    })

    test("should detect windows_64", function () {
      expect(platforms.detect("MyApp-x64.exe")).toEqual(platforms.WINDOWS_64)
      expect(platforms.detect("atom-1.0.9-delta.nupkg")).toEqual(
        platforms.WINDOWS_64,
      )
      expect(platforms.detect("TestSetup.msi")).toEqual(platforms.WINDOWS_64)
      expect(platforms.detect("RELEASES")).toEqual(platforms.WINDOWS_64)
      var chrome = useragent.parse(
        "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.106 Safari/537.36",
      )

      expect(platforms.detectPlatformByUserAgent(chrome)).toEqual(
        platforms.WINDOWS_64,
      )
      var edge = useragent.parse(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2486.0 Safari/537.36 Edge/13.10586",
      )
      expect(platforms.detectPlatformByUserAgent(edge)).toEqual(
        platforms.WINDOWS_64,
      )
    })

    test("should detect linux", function () {
      expect(platforms.detect("enterprise-amd64.tar.gz")).toEqual(
        platforms.LINUX_64,
      )
      expect(platforms.detect("enterprise-amd64.tgz")).toEqual(
        platforms.LINUX_64,
      )
      expect(platforms.detect("enterprise-ia32.tar.gz")).toEqual(
        platforms.LINUX_32,
      )
      expect(platforms.detect("enterprise-ia32.tgz")).toEqual(
        platforms.LINUX_32,
      )
    })

    test("should detect AppImage_32", function () {
      expect(platforms.detect("appimaged-i686.AppImage")).toEqual(
        platforms.LINUX_APPIMAGE_32,
      )
    })

    test("should detect AppImage_64", function () {
      expect(platforms.detect("appimaged-x86_64.AppImage")).toEqual(
        platforms.LINUX_APPIMAGE_64,
      )
    })

    test("should detect debian_32", function () {
      expect(platforms.detect("atom-ia32.deb")).toEqual(platforms.LINUX_DEB_32)
    })

    test("should detect debian_64", function () {
      expect(platforms.detect("atom-amd64.deb")).toEqual(platforms.LINUX_DEB_64)
    })

    test("should detect rpm_32", function () {
      expect(platforms.detect("atom-ia32.rpm")).toEqual(platforms.LINUX_RPM_32)
    })

    test("should detect rpm_64", function () {
      expect(platforms.detect("atom-amd64.rpm")).toEqual(platforms.LINUX_RPM_64)
    })

    describe("Resolve", function () {
      var version = {
        platforms: [
          {
            type: "osx_64",
            filename: "test-3.3.1-darwin.dmg",
            download_url:
              "https://api.github.com/repos/test/test2/releases/assets/793838",
            download_count: 2,
          },
          {
            type: "osx_64",
            filename: "test-3.3.1-darwin-x64.zip",
            download_url:
              "https://api.github.com/repos/test/test2/releases/assets/793869",
            download_count: 0,
          },
          {
            type: "windows_64",
            filename: "atom-1.0.9-delta.nupkg",
            size: 1457531,
            content_type: "application/zip",
            download_url:
              "https://api.github.com/repos/atom/atom/releases/assets/825732",
            download_count: 55844,
          },
          {
            type: "windows_64",
            filename: "atom-1.0.9-full.nupkg",
            size: 78181725,
            content_type: "application/zip",
            download_url:
              "https://api.github.com/repos/atom/atom/releases/assets/825730",
            download_count: 26987,
          },
          {
            type: "linux_32",
            filename: "atom-ia32.tar.gz",
            size: 71292506,
            content_type: "application/zip",
            download_url:
              "https://api.github.com/repos/atom/atom/releases/assets/825658",
            download_count: 2494,
          },
          {
            type: "linux_64",
            filename: "atom-amd64.tar.gz",
            size: 71292506,
            content_type: "application/zip",
            download_url:
              "https://api.github.com/repos/atom/atom/releases/assets/825658",
            download_count: 2494,
          },
          {
            type: "linux_AppImage_32",
            filename: "appimaged-i686.AppImage",
            size: 244728,
            content_type: "application/octet-stream",
            download_url:
              "https://api.github.com/repos/AppImage/AppImageKit/releases/assets/5295931",
            download_count: 55,
          },
          {
            type: "linux_AppImage_64",
            filename: "appimaged-x86_64.AppImage",
            size: 244728,
            content_type: "application/octet-stream",
            download_url:
              "https://api.github.com/repos/AppImage/AppImageKit/releases/assets/5295938",
            download_count: 55,
          },
          {
            type: "linux_rpm_32",
            filename: "atom-ia32.rpm",
            size: 71292506,
            content_type: "application/zip",
            download_url:
              "https://api.github.com/repos/atom/atom/releases/assets/825658",
            download_count: 2494,
          },
          {
            type: "linux_rpm_64",
            filename: "atom-amd64.rpm",
            size: 71292506,
            content_type: "application/zip",
            download_url:
              "https://api.github.com/repos/atom/atom/releases/assets/825658",
            download_count: 2494,
          },
          {
            type: "linux_deb_32",
            filename: "atom-ia32.deb",
            size: 71292506,
            content_type: "application/zip",
            download_url:
              "https://api.github.com/repos/atom/atom/releases/assets/825658",
            download_count: 2494,
          },
          {
            type: "linux_deb_64",
            filename: "atom-amd64.deb",
            size: 71292506,
            content_type: "application/zip",
            download_url:
              "https://api.github.com/repos/atom/atom/releases/assets/825658",
            download_count: 2494,
          },
          {
            type: "windows_64",
            filename: "atom-windows.zip",
            size: 79815714,
            content_type: "application/zip",
            download_url:
              "https://api.github.com/repos/atom/atom/releases/assets/825729",
            download_count: 463,
          },
          {
            type: "windows_64",
            filename: "AtomSetup.exe",
            size: 78675720,
            content_type: "application/zip",
            download_url:
              "https://api.github.com/repos/atom/atom/releases/assets/825728",
            download_count: 5612,
          },
          {
            type: "windows_64",
            filename: "TestSetup.msi",
            size: 78675700,
            content_type: "application/x-msi",
            download_url:
              "https://api.github.com/repos/test/test2/releases/assets/7938398",
            download_count: 1,
          },
        ],
      }

      test("should resolve to best platform", function () {
        expect(platforms.resolve(version, "osx").filename).toEqual(
          "test-3.3.1-darwin.dmg",
        )
        expect(platforms.resolve(version, "win32").filename).toEqual(
          "AtomSetup.exe",
        )
        expect(platforms.resolve(version, "linux_64").filename).toEqual(
          "atom-amd64.tar.gz",
        )
        expect(platforms.resolve(version, "linux_32").filename).toEqual(
          "atom-ia32.tar.gz",
        )
        expect(platforms.resolve(version, "linux_rpm_32").filename).toEqual(
          "atom-ia32.rpm",
        )
        expect(
          platforms.resolve(version, "linux_AppImage_32").filename,
        ).toEqual("appimaged-i686.AppImage")

        expect(
          platforms.resolve(version, "linux_AppImage_64").filename,
        ).toEqual("appimaged-x86_64.AppImage")
        expect(platforms.resolve(version, "linux_rpm_64").filename).toEqual(
          "atom-amd64.rpm",
        )
        expect(platforms.resolve(version, "linux_deb_32").filename).toEqual(
          "atom-ia32.deb",
        )
        expect(platforms.resolve(version, "linux_deb_64").filename).toEqual(
          "atom-amd64.deb",
        )
      })

      test("should resolve to best platform with a preferred filetype", function () {
        expect(
          platforms.resolve(version, "osx", {
            filePreference: [".zip"],
          }).filename,
        ).toEqual("test-3.3.1-darwin-x64.zip")

        expect(
          platforms.resolve(version, "win32", {
            filePreference: [".msi"],
          }).filename,
        ).toEqual("TestSetup.msi")
      })

      test("should resolve to best platform with a wanted filetype", function () {
        expect(
          platforms.resolve(version, "osx", {
            wanted: ".zip",
          }).filename,
        ).toEqual("test-3.3.1-darwin-x64.zip")
      })
    })
  })
})
