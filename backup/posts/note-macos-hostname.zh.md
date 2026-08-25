---
title: 一台 Mac 的三个名字
date: 2024-12-20
tags:
  - macOS
  - 手札
summary: ComputerName、HostName、LocalHostName 各自回答的是谁的提问；附 scutil 常用命令与 Finder 隐藏文件的开关。
---


一台 Mac 其实有三个名字，各自面向不同的提问者：AirDrop 里的邻居、终端里的提示符、局域网里的 Bonjour。它们可以相同，但并不是同一回事。

## 三种主机名

### ComputerName：计算机名称

面向人的名字，相当于设备的「身份标识」，用来在一群设备里认出自己的 Mac。AirDrop 共享文件或其他共享操作时，别人看到的就是它。

由用户自定义，例如「张三的 MacBook Pro」。

在 `macOS Sequoia Version 15.1.1` 中，可通过 `System Settings ▸ General ▸ About ▸ Name` 设置。

```bash
scutil --get ComputerName
scutil --set ComputerName "张三的 MacBook Pro"
```

### HostName：主机名称

主机名用于在系统上标识一台机器。它与 IP 地址的分工是：hostname 在系统层面标识一台机器，IP 地址则在 TCP/IP 网络中唯一标识一台机器——好比主机名是这间房子主人的姓名，IP 地址是它在小区里的门牌号。随着互联网的发展，hostname 的定义也演化为 FQDN（Fully Qualified Domain Name，完全限定域名），用于绝对且唯一地标识接入互联网的每一台计算机。

打开终端，提示符里 `@` 后面的名字就是主机名；`@` 前面是管理员名称——即电脑初始化时设置的管理员名称、开机时头像下方显示的那个名字，可在「系统偏好设置 ▸ 用户与群组」中修改。所以终端每行提示符的格式是：`管理员名称@主机名`。

macOS 按以下顺序确定 HostName，直到取到为止：

1. 从 `/etc/hostconfig` 文件中读取
2. 从系统配置项 `/Library/Preferences/SystemConfiguration/preferences.plist` 中的 `System ▸ System ▸ HostName` 读取
3. 由本机 IP 地址的反向 DNS 查询获取
4. 从系统配置项 `/Library/Preferences/SystemConfiguration/preferences.plist` 中的 `System ▸ Network ▸ HostNames ▸ LocalHostName` 读取
5. 如果以上方法都没获取到，就为默认的 `localhost`

```bash
hostname
scutil --get HostName
scutil --set HostName "zhangsan-macbook-pro"
```

### LocalHostName：Bonjour 名称

本地主机名。同一本地网络里的其他电脑，可以通过这个名字访问你的电脑。

在 `macOS Sequoia Version 15.1.1` 中，可通过 `System Settings ▸ General ▸ Sharing ▸ Local hostname` 设置。

```bash
scutil --get LocalHostName
scutil --set LocalHostName "zhangsan-macbook-pro"
```

## scutil 常用命令

`scutil` 是一个可动态访问 macOS 系统信息的交互式工具。

```bash
scutil --help
```

查看 DNS 配置：

```bash
scutil --dns
```

查看代理配置：

```bash
scutil --proxy
```

查看网络配置：

```bash
scutil --nwi
```

## Finder 显示隐藏文件

与主机名无关，只是同一时期记在同一页上的两行命令。

显示所有文件：

```bash
defaults write com.apple.finder AppleShowAllFiles -bool true; killall Finder
```

不显示系统隐藏文件：

```bash
defaults write com.apple.finder AppleShowAllFiles -bool false; killall Finder
```
