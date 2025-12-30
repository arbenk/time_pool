# time_pool
this is simple timer for record used time form time pool, used html+php+js+mysql with gemini AI ，can put it on the light webserver , can remine me should fix the poject when I wast time.
# 说明
重要说明：这是一个通过谷歌gemini协助下生成的一个网页应用，由于我不是很会写代码，整个应用对我来说就像是黑箱一般无法理解。

这个网页是一个计时器，可以建立很多的小卡片记录每个项目的预计时间和消耗的时间，整个项目需要用到php、js、mysql，一个带有数据库的云服务器即可。

注意在使用前需要修改数据库。

# 效果
<img width="350" height="auto" alt="image" src="https://github.com/user-attachments/assets/0ce80ad4-cda5-42e5-908d-7a7b5446f5c5"/>
<img width="350" height="auto" alt="image" src="https://github.com/user-attachments/assets/710adde4-fc5d-434b-8f95-726dddae195d"/>

# 使用说明
 1. 将所有文件下载到本地
 2. 修改examplel.config_local.php为config_local.php

    修改配置内容
    
      $host = 'localhost';
    
      $db   = '';   #数据库名称
    
      $user = '';     #数据库账号
    
      $pass = '';     #数据库密码''

 3.修改“mysql.sql”中的-- 数据库： `timedatabase`的部分为对应的数据库名称
 
 4.将“mysql.sql”导入到对应的数据库
 
 5.测试，或者上传到服务器上测试。

