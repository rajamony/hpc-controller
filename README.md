[<h2> HPC Controller </h2>](https://github.com/rajamony/hpc-controller)

The **hpc-controller** enables an administrator to control, manage, and
administer access to computing resources. Such intervention has multiple
benefits:

* It enables applications to control whether or not it is not worthwhile for
  them to continue running on the system given its current operating
  conditions.
* It improves the overall utilization of the system by executing applications
  that can better co-exist with each other.

The current version targets the [Amazon AWS cloud](http://aws.amazon.com),
future versions will extend this to other providers and schedulers (e.g.,
[SLURM](https://computing.llnl.gov/linux/slurm/)).

A simple example helps motivate why such management can be beneficial.
Imagine two applications that alternate between compute-dominated and
communication-dominated phases. If these applications run concurrently on a
system and they happen to be in differently dominated phases, they can likely
co-exist on the same part of the cloud system.

Consider what happens now if both application enter a communication dominated
phase.  Not only will both applications suffer as they contend for the
interconnect, but also the compute resources in the system will be
underutilized. At this point, it may be advisable to pause one of the
applications and pair the remaining one with another application that is in a
differently bound phase.

Another advantage of the **hpc-controller** is in dealing with faulty systems.
System components today have extreme levels of semi-autonomous configurability
and fault tolerance built into them. When applied to millions of components,
such independent decision making can lead to systems that are funcitonally
operational, but performing at degraded levels. Such degradation affects
applications differently, depending on whether or not their execution requires
the degraded resource. In such situations, the **hpc-controller**'s
intervention again helps improve application and execution efficiency.

The **hpc-controller** is released under the terms of the [Eclipse Public
License v1.0](http://www.eclipse.org/legal/epl-v10.html), which also
[accompanies](LICENSE.html) this distribution.

