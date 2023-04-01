package com.example.bigfile.controller;

import com.example.bigfile.param.MultipartFileParam;
import com.example.bigfile.result.JsonResult;
import org.apache.commons.io.FileUtils;
import org.apache.tomcat.util.http.fileupload.servlet.ServletFileUpload;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.util.*;
import java.util.stream.Collectors;

/**
 * @version V1.0
 * @Title: 大文件上传
 * @Description: 断点续传.秒传.分块上传
 * @author:
 */
@RestController
@RequestMapping(value = "/bigfile")
public class BigFileController {

    private Logger logger = LoggerFactory.getLogger(BigFileController.class);

    private String fileStorePath = "F:\\kkk\\";

    /**
     * @param fileMd5
     * @Title: 判断文件是否上传过，是否存在分片，断点续传
     * @MethodName: checkBigFile
     * @Exception
     * @Description: 文件已存在，下标为-1
     * 文件没有上传过，下标为零
     * 文件上传中断过，返回当前已经上传到的下标
     */
    @RequestMapping(value = "/check", method = RequestMethod.POST)
    @ResponseBody
    public JsonResult checkBigFile(String fileMd5) {
        JsonResult jr = new JsonResult();
        // 秒传
        File mergeMd5Dir = new File(fileStorePath + "/" + "merge" + "/" + fileMd5);
        if (mergeMd5Dir.exists()) {
            mergeMd5Dir.mkdirs();
            jr.setResultCode(1);//文件已存在，下标为-1
            return jr;
        }
        // 读取目录里的所有文件
        File dir = new File(fileStorePath + "/" + fileMd5);
        File[] childs = dir.listFiles();
        if (childs == null) {
            jr.setResultCode(0);//文件没有上传过，下标为零
        } else {
            jr.setResultCode(2);//文件上传中断过，返回当前已经上传到的下标
            List<String> list = Arrays.stream(childs).map(f->f.getName()).collect(Collectors.toList());
            jr.setResultData(list.toArray());
        }
        return jr;
    }

    /**
     * 上传文件
     *
     * @param param
     * @param request
     * @return
     * @throws Exception
     */
    @RequestMapping(value = "/upload", method = RequestMethod.POST)
    @ResponseBody
    public JsonResult filewebUpload(MultipartFileParam param, HttpServletRequest request) {
        JsonResult jr = new JsonResult();
        boolean isMultipart = ServletFileUpload.isMultipartContent(request);
        // 文件名
        String fileName = param.getName();
        // 文件每次分片的下标
        int chunkIndex = param.getChunk();
        if (isMultipart) {
            File file = new File(fileStorePath + "/" + param.getMd5());
            if (!file.exists()) {
                file.mkdir();
            }
            File chunkFile = new File(
                    fileStorePath + "/" + param.getMd5() + "/" + chunkIndex);
            try {
                FileUtils.copyInputStreamToFile(param.getFile().getInputStream(), chunkFile);
            } catch (Exception e) {
                jr.setResultCode(-1);
                e.printStackTrace();
            }
        }
        logger.info("文件-:{}的小标-:{},上传成功", fileName, chunkIndex);
        File dir = new File(fileStorePath + "/" + param.getMd5());
        File[] childs = dir.listFiles();
        if(childs!=null){
            jr.setResultData(childs.length);
        }
        return jr;
    }

    /**
     * 分片上传成功之后，合并文件
     *
     * @param request
     * @return
     */
    @RequestMapping(value = "/merge", method = RequestMethod.POST)
    @ResponseBody
    public JsonResult filewebMerge(HttpServletRequest request) {
        FileChannel outChannel = null;
        JsonResult jr = new JsonResult();
        int code =0;
        try {
            String fileName = request.getParameter("fileName");
            String fileMd5 = request.getParameter("fileMd5");
            // 读取目录里的所有文件
            File dir = new File(fileStorePath + "/" + fileMd5);
            File[] childs = dir.listFiles();
            if (Objects.isNull(childs) || childs.length == 0) {
                jr.setResultCode(-1);
                return jr;
            }
            // 转成集合，便于排序
            List<File> fileList = new ArrayList<File>(Arrays.asList(childs));
            Collections.sort(fileList, new Comparator<File>() {
                @Override
                public int compare(File o1, File o2) {
                    if (Integer.parseInt(o1.getName()) < Integer.parseInt(o2.getName())) {
                        return -1;
                    }
                    return 1;
                }
            });
            // 合并后的文件
            File outputFile = new File(fileStorePath + "/" + "merge" + "/" + fileMd5 + "/" + fileName);
            // 创建文件
            if (!outputFile.exists()) {
                File mergeMd5Dir = new File(fileStorePath + "/" + "merge" + "/" + fileMd5);
                if (!mergeMd5Dir.exists()) {
                    mergeMd5Dir.mkdirs();
                }
                logger.info("创建文件");
                outputFile.createNewFile();
            }
            outChannel = new FileOutputStream(outputFile).getChannel();
            FileChannel inChannel = null;
            try {
                for (File file : fileList) {
                    inChannel = new FileInputStream(file).getChannel();
                    inChannel.transferTo(0, inChannel.size(), outChannel);
                    inChannel.close();
                    // 删除分片
                    file.delete();
                }
            } catch (Exception e) {
                code =-1;
                e.printStackTrace();
                //发生异常，文件合并失败 ，删除创建的文件
                outputFile.delete();
                dir.delete();//删除文件夹
            } finally {
                if (inChannel != null) {
                    inChannel.close();
                }
            }
            dir.delete(); //删除分片所在的文件夹
        } catch (IOException e) {
            code =-1;
            e.printStackTrace();
        } finally {
            try {
                if (outChannel != null) {
                    outChannel.close();
                }
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
        jr.setResultCode(code);
        return jr;
    }
}
