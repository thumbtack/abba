#!/usr/bin/env python
'''
A CLI tool for formulating an Abba url using data from PostgreSQL
'''

from __future__ import print_function

import argparse
import psycopg2
import sys


TOOL_DESCRIPTION = '''
Formulates an Abba url using data from PostgreSQL

The query passed to this tool should return three columns, which will
become the label, success count, and trial count in Abba.  If the query
flag is not specified, the query will be taken from standard input.

Note that the db parameters are optional, and if not provided psycopg2
will attempt to connect to the default locally-hosted database.
'''


def parse_arguments():
    '''
    Parse the arguments from the command line for this program
    '''
    parser = argparse.ArgumentParser(
        description=TOOL_DESCRIPTION,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        '-d', '--db_params', metavar='PARAMS',
        help='A libpq connection string with params for the target database'
    )
    parser.add_argument(
        '-q', '--query',
        help='The query which will provide the data for Abba',
    )
    return parser.parse_args()


def build_url_from_database_query(dsn, query):
    '''
    Build an Abba URL using data from a PostgreSQL connection and query
    '''
    url_template = 'http://thumbtack.com/labs/abba#{}'

    cursor = psycopg2.connect(dsn).cursor()
    cursor.execute(query)

    if not cursor.rowcount:
        return url_template.format('')

    rows = cursor.fetchall()
    if len(rows[0]) != 3:
        raise ValueError('Query does not return 3 columns of data')

    groups_querystr = '&'.join('{}={}%2C{}'.format(*row) for row in rows)

    return url_template.format(groups_querystr)


def main():
    args = parse_arguments()
    query = args.query if args.query is not None else sys.stdin.read()
    params = args.db_params if args.db_params else ''

    print(build_url_from_database_query(params, query))


if __name__ == '__main__':
    main()
