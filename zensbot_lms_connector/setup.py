from setuptools import find_packages, setup

with open("zensbot_lms_connector/__init__.py") as f:
    version = [line for line in f if "__version__" in line][0].split('"')[1]

setup(
    name="zensbot_lms_connector",
    version=version,
    description="Sync Zensbot LMS fees and payments into ERPNext",
    author="Zensbot",
    author_email="support@zensbot.com",
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
    install_requires=[],
)
