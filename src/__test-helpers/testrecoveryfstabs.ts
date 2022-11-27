export default [
  {
    device: "hammerhead",
    partitions: [
      {
        mountpoint: "system",
        partition: "/dev/block/platform/msm_sdcc.1/by-name/system"
      },
      {
        mountpoint: "data",
        partition: "/dev/block/platform/msm_sdcc.1/by-name/userdata"
      },
      {
        mountpoint: "cache",
        partition: "/dev/block/platform/msm_sdcc.1/by-name/cache"
      },
      {
        mountpoint: "persist",
        partition: "/dev/block/platform/msm_sdcc.1/by-name/persist"
      },
      {
        mountpoint: "firmware",
        partition: "/dev/block/platform/msm_sdcc.1/by-name/modem"
      },
      {
        mountpoint: "boot",
        partition: "/dev/block/platform/msm_sdcc.1/by-name/boot"
      },
      {
        mountpoint: "recovery",
        partition: "/dev/block/platform/msm_sdcc.1/by-name/recovery"
      },
      {
        mountpoint: "misc",
        partition: "/dev/block/platform/msm_sdcc.1/by-name/misc"
      },
      {
        mountpoint: "radio",
        partition: "/dev/block/platform/msm_sdcc.1/by-name/modem"
      },
      {
        mountpoint: "sbl1",
        partition: "/dev/block/platform/msm_sdcc.1/by-name/sbl1"
      },
      {
        mountpoint: "tz",
        partition: "/dev/block/platform/msm_sdcc.1/by-name/tz"
      },
      {
        mountpoint: "rpm",
        partition: "/dev/block/platform/msm_sdcc.1/by-name/rpm"
      },
      {
        mountpoint: "sdi",
        partition: "/dev/block/platform/msm_sdcc.1/by-name/sdi"
      },
      {
        mountpoint: "aboot",
        partition: "/dev/block/platform/msm_sdcc.1/by-name/aboot"
      },
      {
        mountpoint: "imgdata",
        partition: "/dev/block/platform/msm_sdcc.1/by-name/imgdata"
      }
    ],
    fstab:
      "# Android fstab file.\r#<src>                                         <mnt_point>  <type>  <mnt_flags and options>  <fs_mgr_flags>\r\n# The filesystem that contains the filesystem checker binary (typically /system) cannot\r\n# specify MF_CHECK, and must come before any filesystems that do specify MF_CHECK\r\n\r\n/dev/block/platform/msm_sdcc.1/by-name/system       /system         ext4    ro,barrier=1                                                    wait\r\n/dev/block/platform/msm_sdcc.1/by-name/userdata     /data           ext4    noatime,nosuid,nodev,barrier=1,data=ordered,nomblk_io_submit,noauto_da_alloc,errors=panic wait,check,encryptable=/dev/block/platform/msm_sdcc.1/by-name/metadata\r\n/dev/block/platform/msm_sdcc.1/by-name/cache        /cache          ext4    noatime,nosuid,nodev,barrier=1,data=ordered,nomblk_io_submit,noauto_da_alloc,errors=panic wait,check\r\n/dev/block/platform/msm_sdcc.1/by-name/persist      /persist        ext4    nosuid,nodev,barrier=1,data=ordered,nodelalloc,nomblk_io_submit,errors=panic wait\r\n/dev/block/platform/msm_sdcc.1/by-name/modem        /firmware       vfat    ro,shortname=lower,uid=1000,gid=1000,dmask=227,fmask=337        wait\r\n/dev/block/platform/msm_sdcc.1/by-name/boot         /boot           emmc    defaults                                                        defaults\r\n/dev/block/platform/msm_sdcc.1/by-name/recovery     /recovery       emmc    defaults                                                        defaults\r\n/dev/block/platform/msm_sdcc.1/by-name/misc         /misc           emmc    defaults                                                        defaults\r\n/dev/block/platform/msm_sdcc.1/by-name/modem        /radio          emmc    defaults                                                        defaults\r\n/dev/block/platform/msm_sdcc.1/by-name/sbl1         /sbl1           emmc    defaults                                                        defaults\r\n/dev/block/platform/msm_sdcc.1/by-name/tz           /tz             emmc    defaults                                                        defaults\r\n/dev/block/platform/msm_sdcc.1/by-name/rpm          /rpm            emmc    defaults                                                        defaults\r\n/dev/block/platform/msm_sdcc.1/by-name/sdi          /sdi            emmc    defaults                                                        defaults\r\n/dev/block/platform/msm_sdcc.1/by-name/aboot        /aboot          emmc    defaults                                                        defaults\r\n/dev/block/platform/msm_sdcc.1/by-name/imgdata      /imgdata        emmc    defaults                                                        defaults\r\n\r\n/devices/platform/xhci-hcd*                         auto            auto    defaults                                                        voldmanaged=usbdisk:auto,noemulatedsd"
  },
  {
    device: "cooler",
    partitions: [
      {
        mountpoint: "system",
        partition: "/dev/block/platform/mtk-msdc.0/by-name/system"
      },
      {
        mountpoint: "data",
        partition: "/dev/block/platform/mtk-msdc.0/by-name/userdata"
      },
      {
        mountpoint: "cache",
        partition: "/dev/block/platform/mtk-msdc.0/by-name/cache"
      },
      {
        mountpoint: "boot",
        partition: "/dev/block/platform/mtk-msdc.0/by-name/boot"
      },
      {
        mountpoint: "lk",
        partition: "/dev/block/platform/mtk-msdc.0/by-name/lk"
      },
      {
        mountpoint: "logo",
        partition: "/dev/block/platform/mtk-msdc.0/by-name/logo"
      },
      {
        mountpoint: "recovery",
        partition: "/dev/block/platform/mtk-msdc.0/by-name/recovery"
      }
    ],
    fstab:
      "/dev/block/platform/mtk-msdc.0/by-name/system       /system     ext4    defaults    defaults\r\n/dev/block/platform/mtk-msdc.0/by-name/userdata     /data       ext4    defaults    defaults\r\n/dev/block/platform/mtk-msdc.0/by-name/cache        /cache      ext4    defaults    defaults\r\n/dev/block/platform/mtk-msdc.0/by-name/boot         /boot       emmc    defaults    defaults\r\n/dev/block/platform/mtk-msdc.0/by-name/lk           /lk         emmc    defaults    defaults\r\n/dev/block/platform/mtk-msdc.0/by-name/logo         /logo       emmc    defaults    defaults\r\n/dev/block/platform/mtk-msdc.0/by-name/recovery     /recovery   emmc    defaults    defaults"
  },
  {
    device: "frieza",
    partitions: [
      {
        mountpoint: "data",
        partition: "/dev/block/platform/mtk-msdc.0/by-name/userdata"
      },
      {
        mountpoint: "cache",
        partition: "/dev/block/platform/mtk-msdc.0/by-name/system"
      },
      {
        mountpoint: "boot",
        partition: "/dev/block/platform/mtk-msdc.0/by-name/boot"
      },
      {
        mountpoint: "lk",
        partition: "/dev/block/platform/mtk-msdc.0/by-name/lk"
      },
      {
        mountpoint: "logo",
        partition: "/dev/block/platform/mtk-msdc.0/by-name/logo"
      },
      {
        mountpoint: "recovery",
        partition: "/dev/block/platform/mtk-msdc.0/by-name/recovery"
      }
    ],
    fstab:
      "/dev/block/platform/mtk-msdc.0/by-name/userdata     /data       ext4    defaults    defaults\r\n/dev/block/platform/mtk-msdc.0/by-name/system       /cache      ext4    defaults    defaults\r\n/dev/block/platform/mtk-msdc.0/by-name/boot         /boot       emmc    defaults    defaults\r\n/dev/block/platform/mtk-msdc.0/by-name/lk           /lk         emmc    defaults    defaults\r\n/dev/block/platform/mtk-msdc.0/by-name/logo         /logo       emmc    defaults    defaults\r\n/dev/block/platform/mtk-msdc.0/by-name/recovery     /recovery   emmc    defaults    defaults\r\n"
  }
];
