package com.example.bigfile.conf;

//import com.sun.istack.internal.NotNull;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Component
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                // 是否发送cookie
                .allowCredentials(true)
                // 放行哪些域名
                // springboot 2.4.0 之前使用这个 或直接指定放行的域名http://localhost:8081...
                // .allowedOrigins("*")
                .allowedOriginPatterns("*") // springboot 2.4.0 之后使用这个
                // 允许任何方法
                .allowedMethods("GET", "POST", "PUT", "DELETE")
                // 允许任何请求头
                .allowedHeaders("*")
                .exposedHeaders("*")
                // 表明在3600秒内，不需要再发送预检验请求
                .maxAge(3600L)
        ;
    }
}
