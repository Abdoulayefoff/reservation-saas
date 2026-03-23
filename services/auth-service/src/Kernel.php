<?php 

namespace App;
use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Component\HttpKernel\Kernel as BaseKernel;

/**
 * Noyau de l'application (Kernel).
 * C'est le cœur de l'application Symfony. Il charge les bundles, la configuration et définit les environnements.
 */
class Kernel extends BaseKernel 
{ 
    use MicroKernelTrait;
} 
