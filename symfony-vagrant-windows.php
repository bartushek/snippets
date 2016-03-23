// AppKernel.php
    public function getCacheDir()
    {
        if (in_array($this->environment, array('dev', 'test'))) {
            return '/dev/shm/wola/cache/' .  $this->environment;
        }
        return dirname(__DIR__).'/var/cache/'.$this->getEnvironment();
    }

    public function getLogDir()
    {
        if (in_array($this->environment, array('dev', 'test'))) {
            return '/dev/shm/wola/logs';
        }
        return dirname(__DIR__).'/var/logs';
    }
