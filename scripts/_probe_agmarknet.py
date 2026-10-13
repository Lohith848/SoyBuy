import urllib.request, json, ssl, time
from collections import Counter

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
K = "579b464db66ec23bdd00000139f925ee2e7f4a4c7939dfc757acc918"


def get(url):
    for a in (1, 2, 3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            return json.load(urllib.request.urlopen(req, timeout=90, context=ctx))
        except Exception as e:
            print("retry", a, type(e).__name__, str(e)[:100])
            time.sleep(3)
    return {}


base = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=%s&format=json" % K
d = get(base + "&limit=1000&filters%5Bcommodity%5D=Soyabean")
recs = d.get("records", [])
print("soyabean total:", d.get("total"), "returned:", len(recs))
print("dates:", Counter(r.get("arrival_date") for r in recs).most_common(10))
print("states:", Counter(r.get("state") for r in recs).most_common(10))
print("varieties:", Counter(r.get("variety") for r in recs).most_common(6))
print("mp markets:", Counter(r.get("market") for r in recs if r.get("state") == "Madhya Pradesh").most_common(10))
if recs:
    print("sample:", json.dumps(recs[0]))
