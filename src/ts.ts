interface AdbConfig {
  /**   -a                       listen on all network interfaces, not just localhost */
  allInterfaces: boolean;

  /**   -d                       use USB device (error if multiple devices connected) */
  useUsb: boolean;

  /**   -e                       use TCP/IP device (error if multiple TCP/IP devices available) */
  useTcpIp: boolean;

  /**   -s SERIAL                use device with given serial (overrides $ANDROID_SERIAL) */
  serialno?: string;

  /**   -t ID                    use device with given transport id */
  transportId?: string;

  /**   -H                       name of adb server host [default=localhost] */
  host: string | "localhost";

  /**   -P                       port of adb server [default=5037] */
  port: string | number | 5037;

  /** transport-level protocol */
  protocol: "tcp" | "udp";

  /**   -L SOCKET                listen on given socket for adb server [default=tcp:localhost:5037] */
  socket: string | "tcp:localhost:5037";

  /**   --exit-on-write-error    exit if stdout is closed */
  exitOnWriteError: boolean;
}

interface FastbootConfig {
  // -w                         Wipe userdata.
  wipe: boolean;

  //  -s <SERIAL|<tcp|udp:HOST[:PORT]>>   USB or network device
  device?: string | number;

  // -S SIZE[K|M|G]             Break into sparse files no larger than SIZE.
  maxSize?: string;

  // --force                    Force a flash operation that may be unsafe.
  force: boolean;

  // --slot SLOT                Use SLOT; 'all' for both slots, 'other' for non-current slot (default: current active slot).
  slot?: "all" | "current" | "other";

  // --set-active[=SLOT]        Sets the active slot before rebooting.
  setActive?: "all" | "current" | "other";

  // --skip-secondary           Don't flash secondary slots in flashall/update.
  skipSecondary: boolean;

  // --skip-reboot              Don't reboot device after flashing.
  skipReboot: boolean;

  // --disable-verity           Sets disable-verity when flashing vbmeta.
  disableVerity: boolean;

  // --disable-verification     Sets disable-verification when flashing vbmeta.
  disableVerification: boolean;

  // --fs-options=OPTION[,OPTION]   Enable filesystem features. OPTION supports casefold, projid, compress
  fsOptions?: string;

  // --unbuffered               Don't buffer input or output.
  unbuffered: boolean;
}

interface Config {
  [propName: string]: any;
}

interface ArgsModel {
  [propName: string]: [string, any?, any?, string?];
}

interface ToolOptions {
  /** executable in PATH or path to an executable */
  tool: "adb" | "fastboot" | "heimdall";

  /** extra cli flags */
  extraArgs?: string[];

  /** extra environment variables */
  extraEnv?: NodeJS.ProcessEnv;

  /** set PATH environment variable */
  setPath?: boolean;

  /** configuration */
  config?: Config;

  /** object describing flags */
  argsModel?: ArgsModel;

  signals?: AbortSignal[];

  /** additional properties */
  [propName: string]: any;
}
