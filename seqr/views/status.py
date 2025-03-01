from django.db import connections
import logging
import redis
from urllib3.connectionpool import connection_from_url

from settings import SEQR_VERSION, KIBANA_SERVER, REDIS_SERVICE_HOSTNAME, REDIS_SERVICE_PORT, DATABASES
from seqr.utils.search.utils import ping_search_backend
from seqr.views.utils.json_utils import create_json_response

logger = logging.getLogger(__name__)


def status_view(request):
    """Status endpoint for monitoring app availability."""
    dependent_services_ok = True
    secondary_services_ok = True

    # Test database connection
    for db_connection_key in DATABASES.keys():
        try:
            connections[db_connection_key].cursor()
        except Exception as e:
            dependent_services_ok = False
            logger.error('Database "{}" connection error: {}'.format(db_connection_key, e))

    # Test redis connection
    try:
        redis.StrictRedis(host=REDIS_SERVICE_HOSTNAME, port=REDIS_SERVICE_PORT, socket_connect_timeout=3).ping()
    except Exception as e:
        secondary_services_ok = False
        logger.error('Redis connection error: {}'.format(str(e)))

    # Test search backend connection
    try:
        ping_search_backend()
    except Exception as e:
        dependent_services_ok = False
        logger.error('Search backend connection error: {}'.format(str(e)))

    # Test kibana connection
    try:
        resp = connection_from_url('http://{}'.format(KIBANA_SERVER)).urlopen('HEAD', '/status', timeout=3, retries=3)
        if resp.status >= 400:
            raise ValueError('Error {}: {}'.format(resp.status, resp.reason))
    except Exception as e:
        secondary_services_ok = False
        logger.error('Kibana connection error: {}'.format(str(e)))


    return create_json_response(
        {'version': SEQR_VERSION, 'dependent_services_ok': dependent_services_ok, 'secondary_services_ok': secondary_services_ok},
        status= 200 if dependent_services_ok else 400
    )
