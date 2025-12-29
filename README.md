# time_pool
this is simple timer for record used time form time pool, used html+php+js+mysql，can put it on the cheap web site for remine my I should fix the poject when I wiset time.
# 说明
重要说明：这是一个通过谷歌gemini协助下生成的一个网页应用，由于我不是很会写代码，整个应用对我来说就像是黑箱一般无法理解。当前仓库只作为备份使用，不会进行修改或再次开发。

这个网页是一个计时器，可以建立很多的小卡片记录每个项目的预计时间和消耗的时间，整个项目需要用到php、js、mysql，也就是一个带有数据库的云服务器，这真的很便宜。
# 使用说明
 1. 将所有文件下载到本地
 2. 修改api.php中关于数据库的部分

      $host = 'localhost';
    
      $db   = '';   #数据库名称
    
      $user = '';     #数据库账号
    
      $pass = '';     #数据库密码''

 3.修改“mysql.sql”中的-- 数据库： `timedatabase`的部分为对应的数据库名称
 
 4.将“mysql.sql”导入到对应的数据库
 
 5.测试，或者上传到服务器上测试，由于我的技术太差，没有制作网页版快速安装包，这对于我使用AI来写代码的人来说成本太高。

# 其他
icon.svg这个文件是我从iconfont上找来后，自己动手修改的，并没有该文件的版权，我对此并不负责，只是为了好看而已。
