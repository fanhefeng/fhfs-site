---
title: 深克隆、path 与千分位：JavaScript 三则
date: 2024-12-03
tags:
  - 前端
  - 手札
summary: 三件小事，各值一段笔记：用 WeakMap 挡住循环引用的深克隆，path.join 与 path.resolve
  的分野，以及一个只匹配「位置」的千分位正则。
---


这三则彼此并不相关，只是都小到不值得单独成文，又都曾在某个时刻让我停下来查过一次。记在一起，下次就不必再查。

## 深度克隆

深克隆的难点不在递归本身，而在两处细节：循环引用会让朴素的递归无限展开；`Date`、`RegExp` 这类特殊对象也不能按普通对象逐键复制。前者用一个 `WeakMap` 记住「已经克隆过的对象」即可——再次遇到时直接返回之前的副本；后者单独判断、单独构造。

```javascript
function deepClone(obj, hash = new WeakMap()) {
  if (obj === null) return null;
  if (typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof RegExp) return new RegExp(obj);
  if (hash.has(obj)) return hash.get(obj);
  let cloneObj = new obj.constructor();
  hash.set(obj, cloneObj);
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloneObj[key] = deepClone(obj[key], hash);
    }
  }
  return cloneObj;
}
```

## Node 中的 `path.join` 与 `path.resolve`

两者都会使用平台特定的分隔符（Linux 下是 `/`，Windows 下是 `\`）把给定的路径片段连接起来，再对结果做规范化。区别在于：`path.join` 得到的只是一段拼接后的路径片段，并不一定是绝对路径。

### `path.join`

`path.join` 只做拼接。片段里的 `./xx` 与 `/xx` 是等价的，都表示在后面多接一段 `/xx`；单独的 `.` 代表当前位置，拼接时被忽略，所以 `path.join('.', '/folder')` 的结果仍是 `folder`。唯一需要留神的是 `..`——它和 `cd ..` 一样，会回到上一级。

```javascript
console.log('1:', path.join('folder1', 'folder2', 'folder3')); // 1: folder1/folder2/folder3
console.log('2:', path.join('folder1', './folder2', '/folder3')); // 2: folder1/folder2/folder3
console.log('3:', path.join('folder1', '/folder2', '../../folder3')); // 3: folder3

/*
  path.join('folder1', '/folder2', '../../folder3');
  第一步：拼接 folder1，此时路径为 folder1
  第二步：再拼 folder2，此时路径为 folder1/folder2
  第三步：cd .. 回到上一级，此时路径为 folder1；再 cd .. 回到上一级，此时路径为 .；再拼接 folder3，最后结果为 folder3
*/
```

### `path.resolve`

`path.resolve` 把一串路径片段解析为绝对路径。

> 它的原理是：从左到右，每遇到一个路径片段，就把它和之前的路径拼接起来，最终得到一个绝对路径；若某个片段以 `/` 开头，则直接替换为根目录。

所以只需记住一句话：`path.resolve` 从左到右，每遇到一个参数，就像执行了一次 `cd`。

```javascript
// 假设此时路径为 /Users/user/project
console.log(__dirname); // /Users/user/project
path.resolve("folder1", "folder2", "folder3"); // /Users/user/project/folder1/folder2/folder3
path.resolve("folder1", "./folder2", "folder3"); // /Users/user/project/folder1/folder2/folder3
path.resolve("folder1", "./folder2", "/folder3"); // /folder3
/*
  path.resolve("folder1", "./folder2", "/folder3");
  第一步：cd folder1 # 进入当前目录的 folder1 文件夹，此时结果为 /Users/user/project/folder1
  第二步：cd ./folder2 # 进入当前目录的 folder2 文件夹，此时结果为 /Users/user/project/folder1/folder2
  第三步：cd /folder3 # 注意，cd / 实际是回到根目录了，此时结果为 /folder3
*/
```

## 正则实现千分位分隔

把一个不含分隔符的长数字字符串，在每个千位数字前加上 `.` 作为分隔符：例如把 `"1000000000000"` 变成 `"1.000.000.000.000"`。

```javascript
// 正则匹配方法
const str = "100000000000";
// 定义正则表达式
// 正向前瞻断言 (?=...) 不消耗字符，仅检查位置条件
// (\B) 非单词边界，确保不在首位添加分隔符
// (\d{3}) 匹配三个连续数字
// +$ 表示匹配一连串的三个数字直到字符串末尾
const reg = /(?=(\B)(\d{3})+$)/g;
const res = str.replace(reg, ".");
```

整个正则只有一个前瞻断言，不消耗任何字符，匹配到的是「位置」而不是内容——所以 `replace` 实际做的，是在这些位置上逐一插入分隔符。
