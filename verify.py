# -*- coding: utf-8 -*-
"""GeoMon 账号功能 + 诊断流程端到端验证脚本"""
import json, urllib.request, urllib.error, urllib.parse, sys

BASE = "http://localhost:3000/api/trpc"
OUT = []

def log(s):
    OUT.append(s)
    print(s)

def call(proc, token=None, input_=None, method="GET"):
    url = f"{BASE}/{proc}"
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if method == "POST":
        data = json.dumps({"json": input_}).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = json.loads(r.read().decode())
            return True, body
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode())
        except Exception:
            body = {"httpStatus": e.code}
        return False, body

def unwrap(body):
    """tRPC superjson 响应 -> python 对象"""
    return body.get("result", {}).get("data", {}).get("json")

def errcode(body):
    return body.get("error", {}).get("json", {}).get("data", {}).get("code")

def jget(body):
    return body.get("error", {}).get("json", {}).get("message")

# ---------- 1. 三账号登录 ----------
log("=" * 50)
log("【1】三账号登录")
tokens = {}
for u in ["zhanglai", "chenyun", "hanhoo"]:
    ok, body = call("auth.login", input_={"username": u, "password": "GeoMon@2026"}, method="POST")
    data = unwrap(body) if ok else None
    if data and data.get("token"):
        tokens[u] = data["token"]
        log(f"  {u}: 登录成功 role={data['user']['role']} projectId={data['user']['projectId']}")
    else:
        log(f"  {u}: 登录失败 {jget(body)}")

# ---------- 2. 角色权限边界 ----------
log("=" * 50)
log("【2】角色权限边界")

# admin 专属：账号列表
ok, body = call("auth.list", tokens.get("zhanglai"))
log(f"  zhanglai(auth.list): {'通过' if ok else '拒绝'} -> {len(unwrap(body) or [])} 个账号")
ok, body = call("auth.list", tokens.get("chenyun"))
log(f"  chenyun(auth.list):  {'应拒绝' } -> {errcode(body) or jget(body)}")
ok, body = call("auth.list", tokens.get("hanhoo"))
log(f"  hanhoo(auth.list):   {'应拒绝' } -> {errcode(body) or jget(body)}")

# tRPC GET query 传参用 ?input=
def q(proc, token, input_):
    url = f"{BASE}/{proc}?input=" + urllib.parse.quote(json.dumps({"json": input_}))
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return True, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return False, json.loads(e.read().decode())
        except Exception:
            return False, {}

ok, body = q("diagnostics.listByProject", tokens["hanhoo"], {"projectId": 1})
log(f"  hanhoo 读绑定项目1诊断: {'通过' if ok else jget(body)}")
ok, body = q("diagnostics.listByProject", tokens["hanhoo"], {"projectId": 2})
log(f"  hanhoo 读未绑定项目2: 应拒绝 -> {errcode(body) or jget(body)}")

# client mutation 拦截
ok, body = call("diagnostics.create", tokens["hanhoo"], {"projectId": 1}, method="POST")
log(f"  hanhoo 建诊断单(mutation): 应拒绝 -> {errcode(body) or jget(body)}")
ok, body = call("diagnostics.create", tokens["chenyun"], {"projectId": 1}, method="POST")
d1 = unwrap(body)
log(f"  chenyun 建诊断单(项目1): {'通过 id=%s status=%s' % (d1['id'], d1['status']) if ok and d1 else jget(body)}")

# ---------- 3. 诊断全流程 ----------
log("=" * 50)
log("【3】诊断全流程（韩后 hanhoo.com 真实抓取）")
diag_id = d1["id"] if d1 else None
if diag_id:
    log(f"  step1 诊断单 id={diag_id} status=crawling")
    log("  step2 crawl.run 抓取中（真实 HTTP，最长约 30-60s）...")
    ok, body = call("crawl.run", tokens["chenyun"], {"diagnosticId": diag_id}, method="POST")
    res = unwrap(body)
    if ok and res:
        s = res.get("summary", {})
        pages = s.get("pages", [])
        log(f"    抓取状态={res.get('status')} 入口={s.get('entry')} 页面数={len(pages)} 自动评分写入={res.get('suggestionsWritten')}")
        log(f"    robots.found={s.get('robots',{}).get('found')} sitemap.found={s.get('sitemap',{}).get('found')} llms.found={s.get('llms',{}).get('found')}")
        if s.get("error"): log(f"    error={s['error']}")
    else:
        log(f"    crawl.run 失败: {jget(body) or body}")

    # 读回诊断单看 autoScore
    ok, body = q("diagnostics.get", tokens["chenyun"], {"id": diag_id})
    dd = unwrap(body)
    if ok and dd:
        auto = [i for i in dd["indicators"] if i["scoreRow"] and i["scoreRow"].get("autoScore") is not None]
        log(f"    诊断单状态={dd['status']} autoScore 已写入 {len(auto)}/18 项")

    # step3 人工评分（维度1-3 给分，维度4 自动）
    scores = [
        {"indicatorKey": "tech_1", "score": 10, "evidence": "验证评分写入"},
        {"indicatorKey": "tech_2", "score": 10},
        {"indicatorKey": "arch_1", "score": 15},
        {"indicatorKey": "cont_1", "score": 10},
    ]
    ok, body = call("diagnostics.saveScores", tokens["chenyun"], {"diagnosticId": diag_id, "scores": scores}, method="POST")
    res = unwrap(body)
    if ok and res:
        dd = res["diagnostic"]
        log(f"    saveScores: composite={dd['compositeScore']} grade={dd['grade']} status={dd['status']}")
    else:
        log(f"    saveScores 失败: {jget(body) or body}")

    # step4 结单
    ok, body = call("diagnostics.complete", tokens["chenyun"], {"diagnosticId": diag_id}, method="POST")
    log(f"    complete: {'通过' if ok else jget(body)}")

    # step5 报告聚合
    ok, body = q("diagnostics.reportData", tokens["hanhoo"], {"id": diag_id})
    res = unwrap(body)
    if ok and res:
        log(f"    reportData(客户只读视角): project={res['project']['name']} nineGrid格数={len(res.get('nineGrid',[]))} findings={len(res.get('findings',[]))}")
    else:
        log(f"    reportData 失败: {jget(body)}")

# ---------- 4. 监测/看板数据可读性 ----------
log("=" * 50)
log("【4】监测数据抽查（臻选保险 42 天）")
for proc, args, who in [
    ("measurements.stats", {"projectId": 2}, "chenyun"),
    ("pools.get", {"projectId": 2}, "chenyun"),
    ("competitors.list", {"projectId": 2}, "chenyun"),
]:
    ok, body = q(proc, tokens[who], args)
    res = unwrap(body)
    if ok:
        n = len(res) if isinstance(res, list) else "obj"
        log(f"  {proc}: 通过 (返回 {n})")
    else:
        log(f"  {proc}: {errcode(body) or jget(body)}")

# 客户只能看绑定项目
ok, body = q("measurements.stats", tokens["hanhoo"], {"projectId": 2})
log(f"  hanhoo 读项目2监测: 应拒绝 -> {errcode(body) or jget(body)}")
ok, body = q("measurements.stats", tokens["hanhoo"], {"projectId": 1})
log(f"  hanhoo 读项目1监测: {'通过' if ok else errcode(body) or jget(body)}")

log("=" * 50)
log("验证完成")
