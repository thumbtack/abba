from distutils.core import setup

import abba

setup(
    name="ABBA",
    version=abba.__version__,
    description='Tools for statistical analysis of A/B test results',
    author='Steve Howard',
    author_email='steve@thumbtack.com',
    url='http://www.thumbtack.com/labs/abba/',
    license='LICENSE.txt',
    long_description=abba.__doc__,
    packages=['abba', 'abba.test'],
    install_requires=['scipy'],
)
