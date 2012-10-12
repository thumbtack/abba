#! /usr/bin/env python
#
# Mixpanel, Inc. -- http://mixpanel.com/
#
# Python API client library to consume mixpanel.com analytics data.
#
# Modified by Chris Mueller at Thumbtack for  A/B tests

import hashlib
import urllib
import time
import datetime
import sys
import webbrowser

try:
    import json
except ImportError:
    import simplejson as json

API_KEY = 'xxxxxxxxxxxx'
API_SECRET = 'xxxxxxxxxxxx'

class Mixpanel(object):

    ENDPOINT = 'http://mixpanel.com/api'
    VERSION = '2.0'

    def __init__(self, api_key, api_secret):
        self.api_key = api_key
        self.api_secret = api_secret
        
    def request(self, methods, params, format='json'):
        """
            methods - List of methods to be joined, e.g. ['events', 'properties', 'values']
                      will give us http://mixpanel.com/api/2.0/events/properties/values/
            params - Extra parameters associated with method
        """
        params['api_key'] = self.api_key
        params['expire'] = int(time.time()) + 600   # Grant this request 10 minutes.
        params['format'] = format
        if 'sig' in params: del params['sig']
        params['sig'] = self.hash_args(params)

        request_url = '/'.join([self.ENDPOINT, str(self.VERSION)] + methods) + '/?' + self.unicode_urlencode(params)

        request = urllib.urlopen(request_url)
        data = request.read()

        return json.loads(data)

    def unicode_urlencode(self, params):
        """
            Convert lists to JSON encoded strings, and correctly handle any 
            unicode URL parameters.
        """
        if isinstance(params, dict):
            params = params.items()
        for i, param in enumerate(params):
            if isinstance(param[1], list): 
                params[i] = (param[0], json.dumps(param[1]),)

        return urllib.urlencode(
            [(k, isinstance(v, unicode) and v.encode('utf-8') or v) for k, v in params]
        )

    def hash_args(self, args, secret=None):
        """
            Hashes arguments by joining key=value pairs, appending a secret, and 
            then taking the MD5 hex digest.
        """
        for a in args:
            if isinstance(args[a], list): args[a] = json.dumps(args[a])

        args_joined = ''
        for a in sorted(args.keys()):
            if isinstance(a, unicode):
                args_joined += a.encode('utf-8')
            else:
                args_joined += str(a)

            args_joined += '='

            if isinstance(args[a], unicode):
                args_joined += args[a].encode('utf-8')
            else:
                args_joined += str(args[a])

        hash = hashlib.md5(args_joined)

        if secret:
            hash.update(secret)
        elif self.api_secret:
            hash.update(self.api_secret)
        return hash.hexdigest() 

def get_api():
    return Mixpanel(
        api_key = API_KEY, 
        api_secret = API_SECRET
    )

def experiment(funnel, exp, days=None):
    """
    funnel: a Mixpanel funnel ID
    exp: experiment key (a Mixpanel property)
    days: number of days back (defaults to 1 day)
    """
    api = get_api()

    if days is None:
        days = 0

    today = datetime.datetime.now()
    past = today - datetime.timedelta(days=int(days))

    result = api.request(['funnels'], {
        'funnel_id': int(funnel),
        'from_date': past.strftime('%Y-%m-%d'),
        'to_date': today.strftime('%Y-%m-%d'),
        'on': 'properties["%s"]' % exp,
    })

    data = result['data']

    final = {}
    for day, buckets in data.iteritems():
        for bucket_key, events in buckets.iteritems():
            if not final.has_key(bucket_key):
                final[bucket_key] = []
            for i in xrange(0, len(events)):
                if len(final[bucket_key]) < (i + 1):
                    final[bucket_key].append(0)
                final[bucket_key][i] += events[i]['count']

    abba = []
    for key, events in final.iteritems():
        events.reverse()
        query = "%s=%s" % (key, ",".join([str(event) for event in events]))
        if key == "baseline":
            abba.insert(0, query)
        else:
            abba.append(query)

    abba_url = "http://www.thumbtack.com/labs/abba/#" + "&".join(abba)

    print abba_url
    webbrowser.open_new_tab(abba_url)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print "Usage: %s <funnel> <experiment> [days]" % sys.argv[0]
        sys.exit()

    funnel = sys.argv[1]
    exp = sys.argv[2]

    if len(sys.argv) > 3:
        days = sys.argv[3]
        experiment(funnel, exp, days)
    else:
        experiment(funnel, exp)
